---
layout: post
title: Building A Clone Of r/place
subtitle: r/place 클론 제작기
---

레딧의 실시간 온라인 픽셀 아트 [r/place](https://www.youtube.com/watch?v=xjOMPka5WFo) 라는 프로젝트가 있다.
심심하던 때 오랜만에 봤더니 근질근질해져서 클론 프로젝트를 만들어보기로 했다.

## r/place

r/place는 레딧의 많은 유저가 접속해 동시에 픽셀을 채워나가는 만큼, 퍼포먼스가 굉장히 중요하다.
원래는 5분마다 한번씩 한 픽셀을 칠할 수 있지만 나는 자유롭게 채울 수 있도록 해보자.
일단 구현 후에는 레딧에서 했던 것과 같게 성능 테스트와 최적화를 진행한다.

## 프로토타입

먼저 프로젝트를 기본적인 기능만 구현해 프로토타입을 진행하기로 한다.
최대한 빠르고 간략하게 다음과 같은 스펙으로 만들어보기로 했다.

- db 사용 없이 인메모리로 데이터 저장
- 16개의 픽셀을 100x100 캔버스에 그릴 수 있게
- 웹소켓으로 여러멍이서 동시에 그릴 수 있게

여기까지 하루만에 만드는 것을 목표로 했고, 실제로 중간에 게임 좀 하면서 5시간 정도 걸려서 빠르게 만들 수 있었다.

![prototype](/img/place-prototype.png)

아직 줌, 팬, 커서도 없지만 프로젝트의 코어는 구현되었고 실제로 생각보다 더 재미있어서 이후 프로젝트를 끝까지 진행시켜보기로 한다.

## redis

이제 서버를 제대로 된 db를 사용해 만들어야 한다.
먼저 서버에서 사용할 db의 최소 스펙은 다음 정도로 생각했다.

- 1000x1000 캔버스
- 임의의 위치의 픽셀을 가져오는게 O(1)으로 빨라야 한다
- 전체 이미지를 가져오는게 O(1)으로 빨라야 한다
- 백업, 복구 등이 용이해야 한다
- 추후 픽셀 별 히스토리 등을 추가하거나 마이그레이션이 용이해야 한다

GET/SET이 동시에 일어나거나 race condition의 경우 오히려 크게 문제될 일은 없었다.
여러명이 무작위하게 찍어내는데 누가 먼저 찍었는지는 크게 중요하지 않고 에러가 문제될 일은 없다고 봤다.

결국 꽤나 당연하게 redis를 선택했다. 사실 처음부터 정해져있긴 했다.
bitfield를 사용한다고 하면 위 요구사항을 전부 만족시켰다.
픽셀 별 히스토리는 따로 좌표별로 저장하게끔 구현하면 될 것이다. 아니면 redis에 부하를 더이상 주지 않게끔 분리해도 되고


그렇다면 이제 실제로 구현을 해보자.
1000x1000 캔버스에서 한 픽셀 당 16컬러를 4비트씩 저장해 최대한 압축하도록 한다.
그렇다면 특정 위치의 픽셀을 가져오는 로직은 다음과 같이 이루어진다.

```typescript
async function get(x: number, y: number) {
  const offset = y * 1000 + x;
  return await redis.bitfield(key, 'GET', 'u4', `#${offset}`);
}
```

특정 위치의 픽셀의 색을 변경하는 것도 비슷하다.

그리고 사이트를 처음 접속했을 때 전체 이미지를 가져오는 것은 통째로 해당 필드를 바이너리로 보내기로 한다.

```typescript
async function getBoard() {
  return await redis.getBuffer(key);
}
```

프론트엔드에서는 이를 받아서 디코딩 후 캔버스에 그리면 된다.
그런데 TypedArray에 Uint4Array가 없어서 Uint8Array를 사용하고 4비트씩 끊어서 처리해야 한다.

```typescript
const resp = await fetch(...);
const buffer = await resp.arrayBuffer();

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = Math.floor((x + y * data.width) / 2);
    const value = u8[index];
    const isUpper = (x + y * data.width) % 2 === 0;
    const value = (
      isUpper
        ? (value & 0xf0) >> 4
        : value & 0x0f
    );

    drawAt(x, y, value);
  }
}
```

이 때 너무 오랜만에 비트 오더를 생각하려니 좀 헷갈렸다. 다행히 [공식 문서](https://redis.io/docs/latest/commands/bitfield/)에 일반적인 bit endian처럼 취급하면 된다고 잘 정리되어 있었다.

여기까지 했을 때 사용성에도 문제가 딱히 없었고 성능도 괜찮았다. 오토클리커를 동시에 여러명이 켜놓고 싸워도 동시성이나 웹소켓 성능 등에 문제가 없었고, 여기서 더 크게 스케일업을 하지 않는 이상 스펙은 문제가 없다.

딱 하나... 현재는 픽셀 하나 색을 바꿀때 마다 POST 요청을 하나씩 보내는데, cloudflare dns over https를 사용하고 있는데 가끔 rate limit에 걸릴 때가 있더라. 이따가 좀 더 말해보자.

## 캔버스 줌, 팬, 그리고 커서

이런 서비스에 줌 팬이 없으면 말이 안된다.
처음에 직접 구현해보려다가 평생 프론트엔드를 안할 것 같아 라이브러리 [panzoom](https://github.com/anvaka/panzoom)을 사용하기로 한다.

그런데 문제는 panzoom은 무조건 좌클릭으로만 드래그를 할 수 있는데, 나는 좌클릭으로 픽셀을 찍고 우클릭으로 드래그하기를 원했다.
적당히 코드를 수정해 패키지를 새로 npm에 배포해 사용했다. 더블 클릭 줌 비활성화 등도 적당히 넣어 니즈에 맞게 사용했다.

그리고 픽셀에 맞춰주는 커서 역시 panzoom에 의존하여 구현했다.
panzoom은 canvas style에 transform matrix를 적용하는 것으로 팬, 줌을 구현했는데, 이를 이용해 커서 위치를 해당 transform에 투영 후 픽셀에 맞추면 적당히 된다.

![cursor](/img/place-cursor.png)

아직 남아있는 문제는 줌이나 팬 이후 커서 위치와 크기를 계산하는 순서가 보장되지 않는다는 것이다. panzoom에서 드래그 이후 바뀐 transform으로 커서를 움직해야 하는데... 순서가 항상 맞지는 않는 모양이다.
근데 뭐 ㅋ 그정도는 그럴 수 있지 ㅋ

## 백업, 타임랩스

백업 자체는 어렵지 않다. get으로 가져온 바이너리 데이터를 그대로 저장하면 되고, 복구도 똑같다.
데이터를 저장할 때 이미지도 같이 렌더링해 저장하고 싶어 node canvas를 사용해 똑같은 방법으로 렌더링해 저장했다.

처음 백업은 crontab으로 1시간마다 한번씩 백업 스크립트를 돌리게끔 했었는데, 추후 타임랩스로 보려면 인터벌이 더 적은게 좋을 것 같아 10분마다 백업을 하되 백업 시 마지막 스냅샷으로부터 변경사항이 없으면 저장하지 않도록 해두었다.

그렇게 생성된 이미지 리스트로 타임랩스를 만드는 것은 어렵지 않았다.
물론 이미지를 `.bmp` 로 저장한다고 진짜 bmp 포맷으로 저장되지 않는다는 것을 알아차리기 전까지는 어려웠지만..

```sh
$ file backup-2024-04-26T19-00-01.774Z.bmp
backup-2024-04-26T19-00-01.774Z.bmp: PNG image data, 1000 x 1000, 8-bit/color RGBA, non-interlaced
```

ffmpeg의 bad magic number를 보고 한참 이상하다 하다가 어이없게 알아차렸고 아무튼 다음 스크립트로 타임랩스를 돌릴 수 있다.

```sh
ffmpeg -framerate 10 -pattern_type glob -i "backups/*.png" -c:v libx264 -crf 0 output.mp4
```

그렇게 만들어진 타임랩스 영상이다. 처음부터 백업을 해둔게 아니라서 중간부터 하루정도만 찍혀서 너무 아쉽지만 그래도 간지난다.

[![타임랩스](https://img.youtube.com/vi/A-yWi_VQvM4/0.jpg)](https://www.youtube.com/watch?v=A-yWi_VQvM4)

## 32컬러 마이그레이션

그런데? 잘 쓰다가 애들이 색이 너무 부족하다고 추가해달라고 계속해서 요구해왔다.
커비가 너무 핑크색이다, 사람이 전부 심슨 피부색이 된다 등등

4비트 - 16개의 색을 쓰고 있어 너무나 귀찮았지만 뭐 그정도는 해줘야 하지 않을까? 싶어서 그냥 8비트를 쓰고 색을 32개로 늘려주기로 했다. 사실 이정도면 컬러코드를 넣어도 될 것 같지만

아무튼 마이그레이션 작업은 의외로 순탄했다. 먼저 기존 데이터를 잘 백업해둔 상태에서 새로운 키로 데이터 마이그레이션을 하는 스크립트를 대충 작성한다.

```typescript
const bitmap = await redis.getBuffer(srcKey);
const srcArray = new Uint8Array(bitmap!);

const bytes = Math.ceil(WIDTH * HEIGHT);
const buffer = Buffer.alloc(bytes, 0);
const destArray = new Uint8Array(buffer);

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const index = Math.floor((x + y * WIDTH) / 2);
    const value = srcArray[index];
    const isUpper = (x + y * WIDTH) % 2 === 0;
    const c = (
      isUpper
        ? (value & 0xf0) >> 4
        : value & 0x0f
    );

    const offset = x + y * WIDTH;
    destArray[offset] = c;
  }
}

await redis.set(dstKey, Buffer.from(destArray));
```

그리고 서버, 프론트 등에서 기존 4비트 기반으로 체크하는 것들을 전부 바꿔주고 배포하면 끝이다.
어찌저찌 해서 빠르게 배포했고, 새로고침 해 새로운 색을 확인할 수 있었다.

서버 인풋 검증에서 `color < 16` 을 나중에 발견해 새로운 색을 쓴 픽셀들이 사실 서버에 저장되지 않고 있다는 문제점을 발견한건 약 1시간 뒤였다.

## 최적화

지금 상태에서 크게 이상이 없지만, 스케일 업이나 트래픽이 늘어나는 등에 대해 고려해볼 수 있다.

문제가 될 수 있는건 크게 세가지다.
- 첫 로딩에서 이미지 불러와 렌더링하는 병목
- 한 사람이 훨씬 자주 찍는 경우
- 훨씬 많은 사람이 접속하는 경우

### 첫 로딩 렌더링

여기까지 상태에서는 첫 로딩 시 1000x1000 데이터를 받아와, 모든 픽셀을 하나하나 canvas에 1x1 rect에 그리고 있다.
이게 상식적으로 말이 되나? 라는 생각으로 다른 방법을 찾아본 게 ImageData를 만들어 한번에 그리는 방법이었다.

```typescript
const imageData = ctx.createImageData(width, height);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    // ...
    const value = u8[index];
    const [r, g, b] = getRgb(value);

    const i = (x + y * width) * 4;
    imageData.data[i + 0] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
    imageData.data[i + 3] = 255;
  }
}

ctx.putImageData(imageData, 0, 0);
```

과연 얼마나 빨라질까? 어이가 없게도 똑같았다. 둘 다 1.5초 부근으로 큰 차이가 없었는데... 제대로 벤치마크를 해봐야 하지만 지금 사이즈에서 크게 문제가 없어서 일단 두기로 했다.

물론 해결하고자 하면 어떻게든 방법은 있다. 청크 별 로딩, lazy 하게 청크 별 로딩 등등 데이터를 받아오는 것은 문제가 없고 렌더링이 병목이라 크게 기술적인 어려움은 없을 듯 하다.

### 웹소켓 병목

다른 사람들의 변동들이 실시간으로 웹소켓으로 들어오고 있는데, 현재는 모든 변동을 모든 클라이언트에게 쏘고 있고, 한 픽셀당 요청이 하나씩 들어오고 있다.

이게 생각보다 꽤 많은 요청에도 크게 밀리지 않고 있는데, 만약 캔버스가 지금보다 훠어얼씬 많이 커진다 해도 크게 문제를 느끼지는 않을 것 같은게, 서버에서 약 1초간 요청을 쌓아뒀다 변동을 한번에 보내면 문제가 될 일이 없지 않을까 싶다.

물론 좀 더 인프라적인 해결책도 있겠지만 지금은 홈 서버에 띄워둔게 다니까~~

비슷하게 내가 보내는 요청들도 그냥 lazy 하게 쌓아뒀다가 벌크로 보내는 것도 괜찮을 것이고, 반응성 문제는 기획적으로 잘 퉁치면 어떻게든 되겠지 싶다.
이것으로 cloudflare rate limit 문제도 해결될 것이다. 물론 오토클리커가 아니라 동시에 여러 요청을 보내는 경우는 더 쉽겠지만

## 끝?

처음 프로젝트를 시작하게 된 큰 계기는 기술적인 문제들과 스케일업을 위한 문제 해결 등이 재밌어 보여서 였다.
하지만 생각보다 큰 문제가 없었고, 대충 만든 것 치고 꽤 탄탄하게 버텨줘서 레딧이 겪었던 문제정도의 난이도는 어림도 없었다.

오히려 기술적인 문제에 대해서는 좀 더 스케일이 컸다면 뭔가 있었을 것 같은데, 부하 테스트에도 문제가 없어서 여기서 굳이 더 최적화를? 이라는 현실적인 의지의 문제가 생긴게 좀 컸다.

아무튼 사이트는 원래 친구들끼리 사용하고 있는데, 꽤 잦은 주기로 백업을 하고 있고 관리 툴도 만들어둔 상태라 퍼블릭하게 링크를 공개해보려고 한다.

어차피 쓸 사람은 없겠지만 그래도 관심이 있는 사람이 있다면 들어와서 깨작깨작해주면 굉장히 기쁠 것 같다.

[https://place.0ch.me](https://place.0ch.me/)

물론 오픈소스다. [깃헙 리포](https://github.com/20chan/place)