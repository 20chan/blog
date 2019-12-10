---
layout: post
title: Unable to Search in Marketplace
subtitle: vscode 정말 이상한 버그 디버깅
---

이 글은 [vscode#86631](https://github.com/microsoft/vscode/issues/86631) 내용을 그냥 정리해둔 것

## 발단

최근 노트북에 깔린 vscode에서 확장프로그램 검색이 제대로 되질 않았다. 검색을 하면 'Unable to Search in Marketplace' 에러가 뜨고, 확장 프로그램을 지우거나 껐다 켜봐도 똑같은 문제가 일어났따.
비슷한 오류의 깃헙 이슈를 찾아 해결법이라 적혀있는 캐쉬 지우기, 기록 직접 지우기 등을 전부 해봤지만 전혀 도움이 되질 않았다. 어떤 이슈에서는 개발자가 개발자 도구를 켜서 오류 메시지나 네트워크 기록을 보여달래서 내가 봤더니 다음과 같은 오류 로그가 있더라:

```
ERR Unexpected token < in JSON at position 0: SyntaxError: Unexpected token < in JSON at position 0
    at JSON.parse (<anonymous>)
    at Object.t.asJson (file:///C:/Users/2/AppData/Local/Programs/Microsoft VS Code/resources/app/out/vs/workbench/workbench.desktop.main.js:1714:949)

```

되게 호기심을 자극하더라

## 갈등

일단 오류가 발생하는 지점을 찾아가서 알아보기로 했다. 콜스택으로 적당히 들어가보니 `experimentService.ts` 파일에 `getExperiments` 메서드였다.

```js
protected getExperiments(): Promise<IRawExperiment[] | null> {
    if (!this.productService.experimentsUrl || this.configurationService.getValue('workbench.enableExperiments') === false) {
        return Promise.resolve([]);
    }
    return this.requestService.request({ type: 'GET', url: this.productService.experimentsUrl }, CancellationToken.None).then(context => {
        if (context.res.statusCode !== 200) {
            return Promise.resolve(null);
        }
        return asJson(context).then((result: any) => { // <===
            return result && Array.isArray(result['experiments']) ? result['experiments'] : [];
        });
    }, () => Promise.resolve(null));
}
```

문제의 에러는 저 `asJson(context)` 에서 일어났다. 에러 메시지로 대충 추측하면 `context` 가 올바른 json 문자열이 아닌거겠지 싶어서 로그를 찍어봤다. `context` 의 raw string은 다음과 같았다.

```
"<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">↵<path fill-rule="evenodd" clip-rule="evenodd" d="M9.88465 1.69445L8.57246 3H11.346C11.5656 3 11.783 3.04327 11.9858 3.12734C12.1886 3.2114 12.3729 ... 11.7815C4.07069 11.6"
```

언뜻 보면 svg 파일인데? 끝부분이 제대로 끝나지 않는걸 보면 어째 제대로 된 결과는 아닌것 같다.

## 절정

저 이상한 문자열이 나온 리퀘스트는 `this.requestService.request({ type: 'GET', url: this.productService.experimentsUrl }, CancellationToken.None)` 부분이겠고 그렇다면 저 url이 문제가 된걸까? 싶었다. url은 다음과 같았다.

```
https://az764295.vo.msecnd.net/experiments/vscode-experiments.json
```

그리고 크롬으로 들어가서 받은 응답은 다음과 같이 지극히 정상적이었다:

```
{
    "experiments": [
        {
            "id": "cdias.searchForAzure",
            "enabled": true,
            "action": {
                "type": "ExtensionSearchResults",
                "properties": {
                    "searchText": "azure",
                    "preferredResults": [
                        "ms-vscode.vscode-node-azure-pack",
                        "ms-azuretools.vscode-azureappservice",
                        "ms-azuretools.vscode-azurestorage",
                        "ms-azuretools.vscode-cosmosdb"
                    ]
                }
            }
        },
        {
            "id": "saajani.wsl.v1",
            "enabled": true,
            "condition": {
                "displayLanguage": "en",
                "installedExtensions": {
                    "includes": [
                        "ms-vscode-remote.remote-wsl"
                    ]
                },
                "userProbability": 0.05
            },
            "action": {
                "type": "Prompt",
                "properties": {
                    "promptText": "Thanks for trying out the Remote-WSL extension! Can you provide some feedback about WSL in a quick survey?",
                    "commands": [
                        {
                            "text": "I'll help!",
                            "externalLink": "https://www.research.net/r/remoteWSL"
                        },
                        {
                            "text": "No thanks"
                        }
                    ]
                }
            }
        }
    ]
}
```

???????

심지어 개발자 도구에서 네트워크 탭에서도 저 응답이 보이더라

![network](https://user-images.githubusercontent.com/16171816/70490439-b1523380-1b41-11ea-92a3-54a9a77e7bb0.png)

버퍼가 잘못씌였나? 그래서 위 svg 리퀘스트들을 전부 확인해봤지만 일치하는 리퀘스트조차 없었다

그리고 저 리퀘스트를 `copy as cURL`로 복사해서 리퀘스트를 재현해봐도 전혀 이상이 없었다

![curl](https://user-images.githubusercontent.com/16171816/70490843-e14e0680-1b42-11ea-941d-4b3c8b6795bf.png)

## 결말

정말 어이가 없고 실마리도 안잡히지만 당장 문제는 해결해야 하니까 그냥 저부분을 아예 스킵하게끔 설정에서 `workbench.enableExperiments` 값을 `false`로 설정하니 다시 검색이 잘 되고 문제가 없더라

똑같아보이는 이슈가 깃헙에서 다른 유저에게서도 일어난 것 같지만 진전이 하나도 없고 이정도로 황당한 이슈는 처음이었다

이 이슈는 일주일정도 된거같고, 이 삽질은 회사에서 설렁설렁 본거였는데 더 깊이 보고싶었지만 일해야 해서 그만뒀다. 게다가 문제가 일어나는 노트북을 회사에 두고 와서 당장 더 못보는게 너무 아쉽다

지금 이 글을 작성하는 순간에는 이슈에는 아무런 반응이 없고 또 진짜 원인도 모르니까 그냥 해결책만 아는 이상한 버그정도로 생각하고 있다. 진척이 생기면 글 업데이트해야지

## 추가로

아무에게도 일어나지 않는 버그를 직접 디버깅하고 원인 찾아내고 해결하는거 너무 사이버펑키하다
그리고 간지난다

그리고 회사에서 뻘짓만 하는게 아님 원래열심히일함