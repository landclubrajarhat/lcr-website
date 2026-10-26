#!/usr/bin/env python3
"""Stage an XLSX roster privately; never connect to a remote service or import NID."""
import argparse
import json
import os
import posixpath
import re
import uuid
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'p': 'http://schemas.openxmlformats.org/package/2006/relationships',
      'x': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

def sql(value):
    return "'" + str(value or '').replace("'", "''") + "'"

def rels(z, source):
    parent, name = posixpath.split(source)
    path = posixpath.join(parent, '_rels', name + '.rels')
    if path not in z.namelist():
        return {}
    return {r.attrib['Id']: posixpath.normpath(posixpath.join(parent, r.attrib['Target']))
            if not r.attrib['Target'].startswith('/') else r.attrib['Target'].lstrip('/')
            for r in ET.fromstring(z.read(path)) if r.attrib.get('TargetMode') != 'External'}

def stage(path, output):
    output = Path(output).resolve()
    if '.local' not in output.parts:
        raise ValueError('Output must be inside an ignored .local directory')
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist()) > 100 * 1024 * 1024:
            raise ValueError('Workbook is too large')
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = wb.find('s:sheets', NS)
        if len(sheets) != 1:
            raise ValueError('Select a single-sheet Director workbook')
        sheet_path = rels(z, 'xl/workbook.xml')[sheets[0].attrib['{' + NS['r'] + '}id']]
        sheet = ET.fromstring(z.read(sheet_path))
        rows = {}
        for row in sheet.findall('s:sheetData/s:row', NS):
            cells = {}
            for cell in row:
                col = re.match('[A-Z]+', cell.attrib['r'])[0]
                # Never read the sensitive NID column into the staged model.
                if col == 'D':
                    continue
                if cell.find('s:f', NS) is not None:
                    raise ValueError('Formula cells are not accepted in roster fields')
                value = cell.findtext('s:v', '', NS)
                if cell.attrib.get('t') == 's':
                    value = strings[int(value)]
                elif cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext())
                cells[col] = value.strip()
            rows[int(row.attrib['r'])] = cells
        expected = {'A':'Member ID','B':'Name','C':'Mobile','E':'Email Address','F':'Profession','G':'Image'}
        if any(rows.get(1, {}).get(k) != v for k, v in expected.items()):
            raise ValueError('Workbook headers do not match the approved Director format')
        records = {r: v for r, v in rows.items() if r > 1 and (v.get('A') or v.get('B'))}
        seen = set()
        for v in records.values():
            if not re.fullmatch(r'LCR-M\d{3}', v.get('A', '')) or v['A'] in seen:
                raise ValueError('Invalid or duplicate Member ID')
            seen.add(v['A'])
        images = {}
        sheet_links = rels(z, sheet_path)
        for drawing in sheet.findall('s:drawing', NS):
            drawing_path = sheet_links[drawing.attrib['{' + NS['r'] + '}id']]
            image_links = rels(z, drawing_path)
            for anchor in ET.fromstring(z.read(drawing_path)):
                start = anchor.find('x:from/x:row', NS)
                pic = anchor.find('.//a:blip', NS)
                if start is None or pic is None:
                    raise ValueError('Unsupported photo anchor')
                row = int(start.text) + 1
                if row not in records or row in images:
                    raise ValueError('Photo anchor cannot be matched uniquely to a Member ID')
                target = image_links.get(pic.attrib.get('{' + NS['r'] + '}embed'))
                if not target:
                    raise ValueError('Linked/external photos are not supported')
                images[row] = z.read(target)
        statements = ['-- PRIVATE: unpublished staging only. Never commit or deploy this file.', 'BEGIN TRANSACTION;']
        deferred = 0
        for row, record in records.items():
            mobile = record.get('C', '')
            if re.fullmatch(r'1\d{9}', mobile):
                mobile = '0' + mobile
            values = [record['A'], record.get('B',''), mobile, record.get('E',''), record.get('F','')]
            statements.append('INSERT INTO members(id,full_name,mobile,source_email,profession) VALUES(' + ','.join(map(sql, values)) + ');')
            if row in images:
                data = images[row]
                mime = 'image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if data.startswith(b'\xff\xd8\xff') else 'image/webp' if data[:4] == b'RIFF' and data[8:12] == b'WEBP' else None
                photo_id = str(uuid.uuid4())
                # Preserve original privately; publication requires member/admin consent.
                dest = output / (record['A'] + '.photo')
                dest.write_bytes(data)
                os.chmod(dest, 0o600)
                if mime and len(data) <= 204800:
                    statements.append('INSERT INTO media VALUES(' + ','.join([sql(photo_id), sql(record['A']), sql(mime), "X'" + data.hex() + "'", '0']) + ');')
                    statements.append('UPDATE members SET photo_id=' + sql(photo_id) + ' WHERE id=' + sql(record['A']) + ';')
                else:
                    deferred += 1
        statements.append('COMMIT;')
        dest = output / 'private-import.sql'
        dest.write_text('\n'.join(statements), encoding='utf-8')
        os.chmod(dest, 0o600)
        summary = {'members':len(records),'photos':len(images),'photos_requiring_resize_or_conversion':deferred,'identities_granted':0,'published_profiles':0,'nid_imported':False}
        (output / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
        return summary

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('workbook')
    p.add_argument('output', help='New subdirectory under .local/')
    args = p.parse_args()
    try:
        print(json.dumps(stage(args.workbook, args.output)))
    except Exception:
        raise SystemExit('Private staging failed. Check workbook format, IDs, anchors and output location. No remote import performed.')
