"""Publish only reviewed, complete sprite-gen exports, including replacing Maya B.

Run with the sprite-gen virtualenv after review.json is written for each run.
"""
import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image
from review_binding import review_fingerprint

def published_frame_name(fid, source):
    # Keep Maya's old frames intact until the new manifest is committed.
    return f'{Path(profiles[fid]["generationRun"]).name}-{source.name}' if fid in replacements else source.name

def atomic_copy(source, destination):
    temporary = destination.with_name(destination.name + '.tmp')
    shutil.copy2(source, temporary)
    os.replace(temporary, destination)

parser=argparse.ArgumentParser()
parser.add_argument('--registry',type=Path,default=Path('assets/sprites/_generation/roster-v15/roster.json'))
args=parser.parse_args()
profiles=json.loads(args.registry.read_text())
replacements={fid for fid,p in profiles.items() if p.get('replaceExisting',fid=='maya-b')}
catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {FIGHTERS} from './roster.js';process.stdout.write(JSON.stringify(FIGHTERS))"],text=True))
conflicts=[fid for fid in profiles if fid not in replacements and fid in catalog]
if conflicts: raise RuntimeError(f'Already published fighter IDs: {conflicts}; no assets changed')
manifest_path=Path('assets/manifest.json')
manifest=json.loads(manifest_path.read_text())
LABELS={
 'astha':('Pulso tático','Frequência máxima','SINAL DE COMBATE'),
 'biskit':('Estalo veloz','Ritmo acelerado','RITMO SEM PAUSA'),
 'cody':('Refração','Dispersão total','PRISMA DO BOTECO'),
 'd-nelson':('Pulso da união','Todos por um','FORÇA DA UNIÃO'),
 'daddy-ianky':('Ferramenta orbital','Oficina pesada','MESTRE DA OFICINA'),
 'felurian':('Névoa violeta','Noite profunda','BRUMA VIOLETA'),
 'gabiest':('Órbita alienígena','Invasão gravitacional','CONTATO DO TERCEIRO COMBO'),
 'ghostly':('Passo fantasma','Ecos espectrais','PRESENÇA FANTASMA'),
 'ingio':('Batida dourada','Grave do festival','FREQUÊNCIA DOURADA'),
 'leo':('Leque solar','Horizonte radiante','LUZ EM MOVIMENTO'),
 'litte-faster':('Investida veloz','Aceleração total','VELOCIDADE EM VERMELHO'),
 'mountain':('Peso da montanha','Avalanche','FORÇA INABALÁVEL'),
 'mr-g':('Selo do grimório','Runa suprema','MESTRE DO GRIMÓRIO'),
 'musashi':('Investida shinobi','Impacto do pergaminho','CAMINHO DO PERGAMINHO'),
 'p-d-r':('Pressão da faixa','Finalização total','DISCIPLINA DO TATAME'),
 'prefeito':('Bloco da cidade','Plano diretor','COMANDO DA CIDADE'),
 'r1sen':('Chama ascendente','Ressurgimento','CHAMA QUE RETORNA'),
 'sleep':('Batida noturna','Grave da madrugada','PESO DA MADRUGADA'),
 'sonee':('Onda de estilo','Frequência livre','ESTILO NA FREQUÊNCIA'),
 'tony-etch':('Pulso preciso','Rajada de precisão','PRECISÃO DO BALCÃO'),
 'wes':('Punho de aço','Impacto máximo','PUNHO SEM FREIO'),
 'zero-6':('Pulso zero','Rajada seis','ZERO HESITAÇÃO'),
}
staged={}
for fid,profile in profiles.items():
    run=Path(profile['generationRun'])
    review=json.loads((run/'review.json').read_text())
    metrics=json.loads((run/'runtime-metrics.json').read_text())
    request=json.loads((run/'sprite-request.json').read_text())
    if review.get('errors')!=[] or set(review.get('motionReviewed',[]))!=set(request['states']):
        raise RuntimeError(f'{fid}: visual/motion review is incomplete')
    if review.get('contentHash')!=review_fingerprint(run):
        raise RuntimeError(f'{fid}: approval is missing or stale; review these exact files again')
    if len(metrics)!=24 or set(metrics)!=set(request['states']): raise RuntimeError(f'{fid}: incomplete actions')
    runtime={}
    for state,entries in metrics.items():
        if len(entries)!=request['states'][state]['frames']: raise RuntimeError(f'{fid}/{state}: wrong frame count')
        hashes=[]
        for entry in entries:
            source=Path(entry['path'])
            if source.parent!=run/'curated': raise RuntimeError(f'{fid}: foreign sprite')
            with Image.open(source) as image:
                alpha=image.getchannel('A')
                box=alpha.point(lambda a:255 if a>128 else 0).getbbox()
                if image.mode!='RGBA' or alpha.getextrema()!=(0,255) or not box: raise RuntimeError(f'{source}: invalid alpha')
                if box[0]<=0 or box[1]<=0 or box[2]>=image.width or box[3]>=image.height: raise RuntimeError(f'{source}: clipped sprite')
                if abs(entry['anchorY']*image.height-image.getbbox()[3])>1.1: raise RuntimeError(f'{source}: wrong floor anchor')
            if not all(math.isfinite(entry[key]) for key in ('scale','anchorX','anchorY')) or entry['scale']<=0: raise RuntimeError(f'{source}: invalid geometry')
            hashes.append(hashlib.sha256(source.read_bytes()).hexdigest())
        if len(set(hashes))!=len(hashes): raise RuntimeError(f'{fid}/{state}: static repeated frames')
        runtime[state]={'frames':[dict(path=f'assets/sprites/{fid}/curated/{published_frame_name(fid,Path(e["path"]))}',**{key:e[key] for key in ('scale','anchorX','anchorY')}) for e in entries],'fps':request['states'][state]['fps'],'loop':request['states'][state]['loop']}
    if sum(len(s['frames']) for s in runtime.values())!=100: raise RuntimeError(f'{fid}: wrong total frame count')
    if fid in replacements:
        fighter=catalog[fid].copy()
        fighter['identity']=profile['identity']
    else:
        template=next(f for f in catalog.values() if f['power']['kind']==profile['powerKind'])
        power=template['power'].copy()
        power['label'],power['superLabel'],tagline=profile.get('powerLabels') or LABELS[fid]
        agile=fid in {'astha','biskit','cody','litte-faster','sonee','tony-etch','zero-6'}
        heavy=fid in {'daddy-ianky','gabiest','mountain','sleep','wes'}
        fighter={'id':fid,'name':profile['name'],'source':f'assets/sprites/{fid}/base-source.png','identity':profile['identity'],'color':profile['color'],'speed':330 if agile else 270 if heavy else 300,'tempo':.9 if agile else 1.07 if heavy else .98,'visualHeight':320,'damage':{'punch':7 if agile else 10 if heavy else 8,'kick':12 if agile else 15 if heavy else 13},'tagline':tagline,'power':power}
        fighter.update(profile.get('stats',{}))
    staged[fid]=(run,runtime,fighter,metrics)

roster_path=Path('roster.js')
roster_text=roster_path.read_text()
marker='\n};\nexport const fighterIds'
if roster_text.count(marker)!=1: raise RuntimeError('Cannot locate roster boundary')
additions=''
for fid,(run,runtime,fighter,metrics) in staged.items():
    if fid in catalog:
        if fid not in replacements: raise RuntimeError(f'{fid}: already published')
        lines=roster_text.splitlines(keepends=True)
        matching=[i for i,line in enumerate(lines) if line.lstrip().startswith(f"'{fid}':") or line.lstrip().startswith(json.dumps(fid)+':')]
        if len(matching)!=1: raise RuntimeError(f'Cannot locate existing {fid}')
        lines[matching[0]]='  '+json.dumps(fid)+': '+json.dumps(fighter,ensure_ascii=False)+',\n'
        roster_text=''.join(lines)
    else:
        additions+='  '+json.dumps(fid)+': '+json.dumps(fighter,ensure_ascii=False)+',\n'
    asset=Path('assets/sprites')/fid
    (asset/'curated').mkdir(parents=True,exist_ok=True)
    if fid in replacements:
        backup=run/'previous-publication'
        backup.mkdir(exist_ok=True)
        for file in ('base-source.png','runtime-manifest.json','runtime-metrics.json','sprite-request.json','anatomy-annotations.json','provenance.json'):
            if (asset/file).is_file() and not (backup/file).exists(): shutil.copy2(asset/file,backup/file)
    atomic_copy(run/'base-source.png',asset/'base-source.png')
    for entries in metrics.values():
        for entry in entries:
            source=Path(entry['path'])
            destination=asset/'curated'/published_frame_name(fid,source)
            atomic_copy(source,destination)
            entry['path']=str(destination)
    shutil.copy2(run/'sprite-request.json',asset/'sprite-request.json')
    if (run/'anatomy-annotations.json').is_file():
        shutil.copy2(run/'anatomy-annotations.json',asset/'anatomy-annotations.json')
    (asset/'runtime-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    (asset/'runtime-manifest.json').write_text(json.dumps(runtime,indent=2)+'\n')
    (asset/'character-profile.json').write_text(json.dumps(fighter,ensure_ascii=False,indent=2)+'\n')
    (asset/'provenance.json').write_text(json.dumps({'runtimeId':fid,'assetName':fid,'generationRun':str(run),'suppliedReference':profile.get('suppliedReference',f'novos_player_para_implementar/{profile["name"]}.png')},indent=2)+'\n')
    (asset/'review.json').write_text((run/'review.json').read_text())
    manifest[fid]=runtime
roster_text=roster_text.replace(marker,'\n'+additions+'};\nexport const fighterIds')
manifest_temp=manifest_path.with_suffix('.json.tmp')
roster_temp=roster_path.with_suffix('.js.tmp')
manifest_temp.write_text(json.dumps(manifest,indent=2)+'\n')
roster_temp.write_text(roster_text)
os.replace(manifest_temp,manifest_path)
os.replace(roster_temp,roster_path)
print(f'Published {len(staged)-len(replacements)} new fighters and {len(replacements)} replacements with {len(staged)*100} reviewed frames.')
