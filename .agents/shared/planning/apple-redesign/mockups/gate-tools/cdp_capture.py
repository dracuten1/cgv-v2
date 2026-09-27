#!/usr/bin/env python3
"""Designer gate capture: Chrome DevTools Protocol screenshots with forced theme + real CSS viewport.

Why: plain `--headless --screenshot --window-size` yields bitmaps whose CSS viewport can
misrepresent mobile widths; CDP Emulation.setDeviceMetricsOverride sets the true CSS viewport.
"""
import json, base64, sys, subprocess, time, urllib.request, os

def find_ws_url(port, timeout=15):
    deadline=time.time()+timeout
    while time.time()<deadline:
        try:
            v=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version',timeout=2))
            return v['webSocketDebuggerUrl']
        except Exception:
            time.sleep(0.3)
    raise RuntimeError('no CDP endpoint')

class CDP:
    def __init__(self,ws):
        import websocket
        self.ws=websocket.create_connection(ws,max_size=None); self.id=0
    def send(self,method,params=None,session=None):
        self.id+=1; m={'id':self.id,'method':method,'params':params or {}}
        if session: m['sessionId']=session
        self.ws.send(json.dumps(m))
        while True:
            msg=json.loads(self.ws.recv())
            if msg.get('id')==self.id:
                if 'error' in msg: raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get('result',{})
    def wait_load(self,session,to=15):
        self.send('Page.enable',session=session)
        deadline=time.time()+to
        while time.time()<deadline:
            r=self.send('Runtime.evaluate',params={'expression':'document.readyState','returnByValue':True},session=session)
            if r.get('result',{}).get('value')=='complete': return
            time.sleep(0.2)

def main():
    port=9377; outdir=sys.argv[1]; spec=json.loads(sys.argv[2])
    os.makedirs(outdir,exist_ok=True)
    chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    proc=subprocess.Popen([chrome,'--headless=new',f'--remote-debugging-port={port}','--remote-allow-origins=http://127.0.0.1:9377','--no-first-run','--no-default-browser-check','--disable-gpu','--hide-scrollbars','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        ws=find_ws_url(port)
        c=CDP(ws)
        target=c.send('Target.createTarget',params={'url':'about:blank'})
        tid=target['targetId']
        sess=c.send('Target.attachToTarget',params={'targetId':tid,'flatten':True})['sessionId']
        log=[]
        for item in spec:
            url=item['url']; name=item['name']; w=item['w']; h=item['h']; theme=item.get('theme','light')
            c.send('Emulation.setDeviceMetricsOverride',params={'width':w,'height':h,'deviceScaleFactor':2,'mobile':w<800},session=sess)
            c.send('Emulation.setEmulatedMedia',params={'features':[{'name':'prefers-color-scheme','value':theme}]},session=sess)
            c.send('Page.navigate',params={'url':url},session=sess)
            c.wait_load(sess)
            time.sleep(0.5)
            # hashchange runs after load; verify the requested specimen is visible before capture.
            if item.get('expectVisible'):
                selector=json.dumps('#'+item['expectVisible'])
                check=f"document.querySelector({selector})?.classList.contains('is-visible')"
                result=c.send('Runtime.evaluate',params={'expression':check,'returnByValue':True},session=sess)
                if not result.get('result',{}).get('value'):
                    time.sleep(0.5)
                    result=c.send('Runtime.evaluate',params={'expression':check,'returnByValue':True},session=sess)
                    if not result.get('result',{}).get('value'):raise RuntimeError(f'Expected specimen not visible: {selector} {url}')
            if item.get('clickSelector'):
                selector=json.dumps(item['clickSelector'])
                count=int(item.get('clickCount',1))
                expr=f"for(let i=0;i<{count};i++)document.querySelector({selector})?.click()"
                c.send('Runtime.evaluate',params={'expression':expr},session=sess)
                time.sleep(0.5)
            if item.get('scrollY') is not None:
                c.send('Runtime.evaluate',params={'expression':f"window.scrollTo(0, {int(item['scrollY'])})"},session=sess)
                time.sleep(0.15)
            # theme=light mockups follow data-theme=light only via query param
            shot=c.send('Page.captureScreenshot',params={'format':'png'},session=sess)
            path=os.path.join(outdir,name)
            open(path,'wb').write(base64.b64decode(shot['data']))
            probe=c.send('Runtime.evaluate',params={'expression':"JSON.stringify({t:document.title,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,scrollY:window.scrollY,theme:document.documentElement.dataset.theme||null,hash:location.hash})",'returnByValue':True},session=sess)
            log.append({'name':name,'url':url,'viewport':f'{w}x{h}','theme':theme,'probe':probe.get('result',{}).get('value')})
            print(json.dumps(log[-1]))
        open(os.path.join(outdir,'capture-log.json'),'w').write(json.dumps(log,indent=1))
    finally:
        proc.terminate()

if __name__=='__main__': main()
