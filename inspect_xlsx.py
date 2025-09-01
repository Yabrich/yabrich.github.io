import zipfile
from xml.etree import ElementTree as ET

zf = zipfile.ZipFile('irigo_trips.xlsx')
# Read workbook to get sheet order
wb = ET.fromstring(zf.read('xl/workbook.xml'))
ns = {'ns':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sheets = wb.find('ns:sheets', ns)
order = []
for s in sheets.findall('ns:sheet', ns):
    order.append((s.attrib.get('name'), s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')))
rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
relmap = {}
for r in rels:
    relmap[r.attrib['Id']] = r.attrib['Target']
# first sheet path
first_rel = relmap[order[0][1]]
if not first_rel.startswith('worksheets/'):
    first_rel = 'worksheets/' + first_rel
sheet_xml = zf.read('xl/' + first_rel)
ws = ET.fromstring(sheet_xml)
# Read shared strings for text lookup
shared = {}
try:
    sst = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    si_elems = sst.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si')
    for i, si in enumerate(si_elems):
        t = ''.join([t.text or '' for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')])
        shared[i] = t
except KeyError:
    pass
# Get first row values
rows = ws.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
first = rows[0]
headers = []
for c in first:
    v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
    if v is None:
        headers.append('')
        continue
    if c.attrib.get('t') == 's':
        headers.append(shared.get(int(v.text), ''))
    else:
        headers.append(v.text)
print('First sheet name:', order[0][0])
print('Header cells:', headers)
