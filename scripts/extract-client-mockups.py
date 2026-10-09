"""Extract the mockup images from a client "Website Changes" workbook.

Usage: python -I scripts/extract-client-mockups.py <workbook.xlsx> <out-dir>

Writes one folder per sheet, naming each image <n>-<anchor cell>-<mockup title>,
where the title is the nearest "Role - Page" label above/left of the image.
Also writes <out-dir>/_index.json (sections, notes, images) for building a tracker.
Standard library only.
"""
import sys, zipfile, re, json, os, posixpath, xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
M='http://schemas.openxmlformats.org/spreadsheetml/2006/main'; R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
X='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'; A='http://schemas.openxmlformats.org/drawingml/2006/main'
PR='http://schemas.openxmlformats.org/package/2006/relationships'
z=zipfile.ZipFile(src)
def rels(path):
    d,b=posixpath.split(path); rp=f"{d}/_rels/{b}.rels"
    if rp not in z.namelist(): return {}
    return {r.get('Id'):posixpath.normpath(posixpath.join(d,r.get('Target'))) if not r.get('Target').startswith('/') else r.get('Target').lstrip('/') for r in ET.fromstring(z.read(rp))}
ss=[''.join(t.text or '' for t in si.iter(f'{{{M}}}t')) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(f'{{{M}}}si')]
def colnum(s):
    n=0
    for ch in s: n=n*26+ord(ch)-64
    return n-1
def colname(n):
    s=''
    n+=1
    while n: n,r=divmod(n-1,26); s=chr(65+r)+s
    return s
wbrels=rels('xl/workbook.xml')
TITLE=re.compile(r"^(Admin|Coach|Teachers?|Parents?|Kitchen|HR|Student Supp+ort|Support Staff|Other Staff|Employee|Front Screen|Parent Screen|Register Pin|Set Start Day|Add Training|This pops|Admin & Coach|Coach Reports|Teacher)\b",re.I)
sheets=[]
for i,s in enumerate(ET.fromstring(z.read('xl/workbook.xml')).find(f'{{{M}}}sheets')):
    name=s.get('name'); path=wbrels[s.get(f'{{{R}}}id')]
    root=ET.fromstring(z.read(path))
    cells=[]
    for c in root.iter(f'{{{M}}}c'):
        v=c.find(f'{{{M}}}v'); t=c.get('t')
        val = ss[int(v.text)] if (t=='s' and v is not None) else (v.text if v is not None else '')
        val=(val or '').replace('\ufffd','…').strip()
        if not val: continue
        m=re.match(r'([A-Z]+)(\d+)',c.get('r'))
        cells.append({'row':int(m.group(2))-1,'col':colnum(m.group(1)),'ref':c.get('r'),'text':' '.join(val.split())})
    imgs=[]
    srels=rels(path)
    for d in root.iter(f'{{{M}}}drawing'):
        dpath=srels[d.get(f'{{{R}}}id')]; drels=rels(dpath)
        for anc in ET.fromstring(z.read(dpath)):
            fr=anc.find(f'{{{X}}}from'); blip=anc.find(f'.//{{{A}}}blip')
            if fr is None or blip is None: continue
            to=anc.find(f'{{{X}}}to')
            imgs.append({'row':int(fr.find(f'{{{X}}}row').text),'col':int(fr.find(f'{{{X}}}col').text),
                         'area':(int(to.find(f'{{{X}}}row').text)-int(fr.find(f'{{{X}}}row').text))*(int(to.find(f'{{{X}}}col').text)-int(fr.find(f'{{{X}}}col').text)) if to is not None else 0,
                         'media':drels[blip.get(f'{{{R}}}embed')]})
    sheets.append({'idx':i+1,'name':name,'cells':cells,'imgs':imgs})
def slug(t,n=70): return re.sub(r'[^A-Za-z0-9]+','-',t).strip('-')[:n].strip('-') or 'x'
os.makedirs(out,exist_ok=True)
result=[]
total=0
for sh in sheets:
    EXTRA={'Teacher Daily Checklist','Teacher Student Profile Page','This pops up when they click on the IPP'}
    def is_title(t): return bool(TITLE.match(t)) and (' - ' in t or '#' in t or 'pop up' in t.lower() or t in EXTRA)
    titles=[c for c in sh['cells'] if is_title(c['text'])]
    def owner(r,c,slack=1):
        cand=[t for t in titles if t['row']<=r+slack and t['col']<=c+slack]
        return max(cand,key=lambda t:(t['row'],t['col'])) if cand else None
    sdir=f"{sh['idx']:02d}-{slug(sh['name'],40)}"
    files=[]
    for n,im in enumerate(sorted(sh['imgs'],key=lambda m:(m['row'],m['col'])),1):
        o=owner(im['row'],im['col'])
        label=o['text'] if o else sh['name']
        ext=posixpath.splitext(im['media'])[1]
        fn=f"{n:02d}-{colname(im['col'])}{im['row']+1}-{slug(label)}{ext}"
        os.makedirs(os.path.join(out,sdir),exist_ok=True)
        with open(os.path.join(out,sdir,fn),'wb') as f: f.write(z.read(im['media']))
        files.append({'file':f"{sdir}/{fn}",'title':o['ref'] if o else None,'small':im['area']<12})
        total+=1
    secs={}
    order=[]
    for c in sorted(sh['cells'],key=lambda c:(c['row'],c['col'])):
        if c in titles:
            secs.setdefault(c['ref'],{'title':c['text'],'ref':c['ref'],'col':c['col'],'items':[],'imgs':[]}); order.append(c['ref']); continue
        o=owner(c['row'],c['col'],slack=0)
        key=o['ref'] if o else '_general'
        if key not in secs:
            secs[key]={'title':'General notes','ref':None,'col':0,'items':[],'imgs':[]}; order.insert(0,key) if key=='_general' else order.append(key)
        base=o['col'] if o else 0
        secs[key]['items'].append({'text':c['text'],'ref':c['ref'],'depth':max(0,c['col']-base-1)})
    for f in files:
        key=f['title'] or '_general'
        secs.setdefault(key,{'title':'General notes','ref':None,'col':0,'items':[],'imgs':[]})
        if key not in order: order.insert(0,key)
        secs[key]['imgs'].append(f)
    result.append({'idx':sh['idx'],'name':sh['name'],'dir':sdir,'sections':[secs[k] for k in dict.fromkeys(order)]})
json.dump(result,open(os.path.join(out,'_index.json'),'w'),indent=1)
print('images',total)
