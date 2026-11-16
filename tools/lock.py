"""Inject (or refresh) the BIG domain lock + watermark into built HTML files.
usage: python3 lock.py <site-name> <own-host> file1.html [file2.html ...]
Idempotent: replaces anything between the BIGLOCK markers."""
import sys,re,hashlib,secrets,datetime,os
site,own,files=sys.argv[1],sys.argv[2].split(','),sys.argv[3:]
ALLOW=['claude.ai','claudeusercontent.com','claude.site','anthropic.com','fv6ntdqpg5-pixels-projects.vercel.app']+own
H=[hashlib.sha256(('big:'+a).encode()).hexdigest()[:16] for a in ALLOW]
bid=os.environ.get('BIGBUILD') or secrets.token_hex(6)
# small sync sha256 for the browser
SHA="function S(r){function u(s){var o=[],i,c;for(i=0;i<s.length;i++){c=s.charCodeAt(i);if(c<128)o.push(c);else if(c<2048)o.push(192|c>>6,128|c&63);else o.push(224|c>>12,128|c>>6&63,128|c&63)}return o}var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],b=u(r),l=b.length*8,i,j;b.push(128);while(b.length%64!=56)b.push(0);for(i=7;i>=0;i--)b.push(i>3?0:(l>>>(i*8))&255);var H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],W=[];for(i=0;i<b.length;i+=64){for(j=0;j<16;j++)W[j]=b[i+4*j]<<24|b[i+4*j+1]<<16|b[i+4*j+2]<<8|b[i+4*j+3];for(j=16;j<64;j++){var x=W[j-15],y=W[j-2];W[j]=W[j-16]+((x>>>7|x<<25)^(x>>>18|x<<14)^x>>>3)+W[j-7]+((y>>>17|y<<15)^(y>>>19|y<<13)^y>>>10)|0}var a=H[0],c=H[1],d=H[2],e=H[3],f=H[4],g=H[5],h=H[6],k=H[7];for(j=0;j<64;j++){var t1=k+((f>>>6|f<<26)^(f>>>11|f<<21)^(f>>>25|f<<7))+(f&g^~f&h)+K[j]+W[j]|0,t2=((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+(a&c^a&d^c&d)|0;k=h;h=g;g=f;f=e+t1|0;e=d;d=c;c=a;a=t1+t2|0}H[0]=H[0]+a|0;H[1]=H[1]+c|0;H[2]=H[2]+d|0;H[3]=H[3]+e|0;H[4]=H[4]+f|0;H[5]=H[5]+g|0;H[6]=H[6]+h|0;H[7]=H[7]+k|0}return H.map(function(v){return('00000000'+(v>>>0).toString(16)).slice(-8)}).join('')}"
JS=("(function(){"+SHA+"var A=@@A@@,W='BIG|(c) 2026 Randy Barnhill|@@S@@|@@B@@';window.__BIGW=S(W);"
 "function ok(h){var p=String(h||'').toLowerCase().split('.');for(var i=0;i<p.length;i++)if(A.indexOf(S('big:'+p.slice(i).join('.')).slice(0,16))>=0)return true;return false}"
 "var g=ok(location.hostname);try{var o=location.ancestorOrigins;if(!g&&o)for(var i=0;i<o.length;i++)if(ok(new URL(o[i]).hostname))g=true}catch(e){}"
 "if(g)return;function bar(){if(document.getElementById('biglk'))return;var d=document.createElement('div');d.id='biglk';d.setAttribute('role','alert');"
 "d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(42,14,14,.94);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:700 18px system-ui,sans-serif';"
 "d.textContent='Unlicensed copy ('+location.hostname+'). \\u00a9 2026 Randy Barnhill, Barnhill Industrial Group. All rights reserved. This tool may only be used at its licensed address.';document.body.appendChild(d)}"
 "if(document.body)setTimeout(bar,30000);else addEventListener('DOMContentLoaded',function(){setTimeout(bar,30000)})})();").replace('@@A@@',repr(H).replace(' ','')).replace('@@S@@',site).replace('@@B@@',bid)
block='<!--BIGLOCK--><script>/*! (c) 2026 Randy Barnhill. All rights reserved. Licensed use only. */'+JS+'</script><!--/BIGLOCK-->'
for f in files:
    h=open(f).read()
    h=re.sub(r'<!--BIGLOCK-->.*?<!--/BIGLOCK-->','',h,flags=re.S)
    i=h.rfind('</body>')
    h=h[:i]+block+h[i:] if i>0 else h+block
    open(f,'w').write(h)
log=os.path.join(os.path.dirname(os.path.abspath(files[0])) if files else '.','builds.log')
print(site,'build',bid,'watermark sha256(',"'BIG|(c) 2026 Randy Barnhill|%s|%s'"%(site,bid),') files',files)
