#!/usr/bin/env python3
import csv, json, os, re, html, time
from openai import OpenAI
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

VALID = {
    "produits": {
        "cheveux": ["cire","coiffant","gel","shampooing-cheveux"],
        "barbe": ["baume-a-barbe","huile-a-barbe","kit","entretien-barbe","shampooing-a-barbe"],
        "rasage": ["pre-rasage","rasage-produits","apres-rasage"],
        "corps": ["deodorant","savon"],
        "hygiene-et-entretien": ["hygiene","entretien-materiel"],
        "couleur": [],
    },
    "materiel": {
        "tondeuse": ["clipper","trimmer","shaver","lames-et-accessoires"],
        "brosse-et-peigne": ["brosse","peigne"],
        "ciseaux": ["sculpteur","ciseaux-droits"],
        "seche-cheveux": [],
        "rasoir-et-accessoire-de-rasage": ["rasoir","lames-de-rasoir","accessoires-de-rasage"],
        "accessoire": ["souffleur","vaporisateur-et-nebuliseur","tapis-et-organisateur","capes","balai-a-cou-et-brosse","sac","miroir-a-main","outils-coloration","accessoires"],
    }
}

SYS = 'Tu es expert en classification produits barbier. Reponds TOUJOURS avec JSON: {"results":[{"handle":"...","category":"produits|materiel","subcategory":"...","subsubcategory":"..."}]}'

GUIDE = """CATEGORIES:
produits/cheveux/cire: cires wax pommades cheveux
produits/cheveux/coiffant: sprays mousses cremes coiffantes fixateurs laques brillantines
produits/cheveux/gel: gels coiffants
produits/cheveux/shampooing-cheveux: shampooings cheveux
produits/barbe/baume-a-barbe: baumes barbe
produits/barbe/huile-a-barbe: huiles barbe
produits/barbe/kit: coffrets kits sets barbe
produits/barbe/entretien-barbe: cremes lotions conditionners barbe
produits/barbe/shampooing-a-barbe: shampooings barbe
produits/rasage/pre-rasage: huiles pre-rasage preparation
produits/rasage/rasage-produits: cremes mousses savons a raser
produits/rasage/apres-rasage: apres-rasages lotions baumes apres-rasage
produits/corps/deodorant: deodorants
produits/corps/savon: savons corps
produits/hygiene-et-entretien/hygiene: desinfectants sprays hygiene nettoyants
produits/hygiene-et-entretien/entretien-materiel: huiles tondeuse lubrifiants entretien
produits/couleur: colorations teintures (subsubcategory vide)
materiel/tondeuse/clipper: tondeuses clippers
materiel/tondeuse/trimmer: trimmers contour finition
materiel/tondeuse/shaver: rasoirs electriques shavers
materiel/tondeuse/lames-et-accessoires: lames remplacement tondeuse
materiel/brosse-et-peigne/brosse: brosses cheveux barbe
materiel/brosse-et-peigne/peigne: peignes
materiel/ciseaux/sculpteur: ciseaux effileurs sculpteurs
materiel/ciseaux/ciseaux-droits: ciseaux droits coiffure
materiel/seche-cheveux: seche-cheveux diffuseurs (subsubcategory vide)
materiel/rasoir-et-accessoire-de-rasage/rasoir: rasoirs droits surete manuels
materiel/rasoir-et-accessoire-de-rasage/lames-de-rasoir: lames rasoir surete
materiel/rasoir-et-accessoire-de-rasage/accessoires-de-rasage: blaireaux bols supports
materiel/accessoire/souffleur: souffleurs air
materiel/accessoire/vaporisateur-et-nebuliseur: vaporisateurs nebuliseurs
materiel/accessoire/tapis-et-organisateur: tapis organisateurs porte-outils
materiel/accessoire/capes: capes coiffure tabliers
materiel/accessoire/balai-a-cou-et-brosse: balais cou brosses nettoyage
materiel/accessoire/sac: sacs barbier mallettes housses
materiel/accessoire/miroir-a-main: miroirs main
materiel/accessoire/outils-coloration: pinceaux bols coloration teinture
materiel/accessoire/accessoires: autres accessoires barbier"""

def clean(t):
    if not t: return ""
    t = re.sub(r"<[^>]+>"," ",t)
    t = html.unescape(t)
    return re.sub(r"\s+"," ",t).strip()[:180]

def validate(cat,sub,ss):
    cat=cat.lower().strip(); sub=sub.lower().strip(); ss=(ss or "").lower().strip()
    if cat not in VALID: return "produits","cheveux","coiffant"
    if sub not in VALID[cat]:
        sub=list(VALID[cat].keys())[0]; ss=""
    v=VALID[cat][sub]
    if v and ss not in v: ss=v[0]
    return cat,sub,ss

def classify_batch(batch):
    msg=f"{GUIDE}\n\nClassifie:\n{json.dumps(batch,ensure_ascii=False)}\n\nReponds: {{\"results\":[...]}}"
    r=client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role":"system","content":SYS},{"role":"user","content":msg}],
        temperature=0.1,response_format={"type":"json_object"},max_tokens=2500
    )
    d=json.loads(r.choices[0].message.content)
    if "results" in d: return d["results"]
    for v in d.values():
        if isinstance(v,list) and v and isinstance(v[0],dict): return v
    if isinstance(d,list): return d
    raise ValueError(f"Format: {list(d.keys())}")

print("Lecture CSV...")
products={}
with open("/home/ubuntu/upload/products_export_1.csv","r",encoding="utf-8") as f:
    for row in csv.DictReader(f):
        h=row.get("Handle","").strip()
        if not h or h in products: continue
        t=row.get("Title","").strip()
        if not t: continue
        try: price=float(row.get("Variant Price","0") or 0)
        except: price=0
        if row.get("Status","active").lower()!="active" or price<=0: continue
        products[h]={"handle":h,"title":t,"vendor":row.get("Vendor","").strip(),"type":row.get("Type","").strip(),"tags":row.get("Tags","").strip()[:120],"desc":clean(row.get("Body (HTML)",""))}

print(f"Produits: {len(products)}")

BATCH=15
items=list(products.values())
results={}
total=(len(items)+BATCH-1)//BATCH
print(f"Classification ({total} lots de {BATCH})...")

for i in range(0,len(items),BATCH):
    batch=items[i:i+BATCH]
    bn=i//BATCH+1
    api_b=[{"handle":p["handle"],"title":p["title"],"vendor":p["vendor"],"type":p["type"],"desc":p["desc"][:100]} for p in batch]
    print(f"  Lot {bn}/{total}...",end=" ",flush=True)
    for attempt in range(3):
        try:
            classified=classify_batch(api_b)
            ok=0; done=set()
            for item in classified:
                if not isinstance(item,dict): continue
                h=item.get("handle","")
                if not h: continue
                c,s,ss=validate(item.get("category","produits"),item.get("subcategory","cheveux"),item.get("subsubcategory",""))
                results[h]={"category":c,"subcategory":s,"subsubcategory":ss}
                done.add(h); ok+=1
            for p in batch:
                if p["handle"] not in done:
                    results[p["handle"]]={"category":"produits","subcategory":"cheveux","subsubcategory":"coiffant"}
            print(f"OK ({ok}/{len(batch)})")
            break
        except Exception as e:
            if attempt<2: print(f"retry...",end=" ",flush=True); time.sleep(2)
            else:
                print(f"ERREUR {e}")
                for p in batch: results[p["handle"]]={"category":"produits","subcategory":"cheveux","subsubcategory":"coiffant"}
    if i+BATCH<len(items): time.sleep(0.4)

print(f"\nTotal: {len(results)} classes")
with open("/home/ubuntu/barberparadise/classifications.json","w",encoding="utf-8") as f:
    json.dump(results,f,ensure_ascii=False,indent=2)
print("Sauvegarde: /home/ubuntu/barberparadise/classifications.json")

from collections import Counter
c=Counter(f"{v['category']}/{v['subcategory']}" for v in results.values())
print("\nRepartition:")
for k,n in sorted(c.items(),key=lambda x:-x[1]): print(f"  {k}: {n}")
