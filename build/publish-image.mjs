import {spawnSync} from 'node:child_process';
const [image,tag]=process.argv.slice(2);
if(!image||!tag||!/^([a-z0-9]+(?:[._-][a-z0-9]+)*\/)+[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(image)||!/^[\w][\w.-]{0,127}$/.test(tag)||tag==='latest'){
 console.error('Usage: npm run image:publish -- dockerhub-user/repository immutable-release-tag');process.exit(1);
}
function run(args){const result=spawnSync('docker',args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
run(['buildx','build','--platform','linux/amd64','--load','-t',`${image}:${tag}`,'-t',`${image}:latest`,'.']);
run(['push',`${image}:${tag}`]);
run(['push',`${image}:latest`]);
console.log(`Published ${image}:${tag} and ${image}:latest. Use the release tag in Dockhand for predictable upgrades and rollback.`);
