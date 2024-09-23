---
title: Arch on Surface Book 2 - 2
date: 2020-03-22
description: 350만원짜리 리눅스 랩탑 만들기 - DE
---

사람들이 그렇게 좋아하는 Wayland를 한번 써보고 싶었지만 서피스 리눅스에서는 [문제](https://github.com/jakeday/linux-surface/issues/389)가 좀 있는것 같아서 익숙한 X Window를 선택했다.

윈도우 매니저는 저번에 openbox를 썼다 윈도우 배치가 타일링은 커녕 사이즈 제대로 조절하는것 조차 안되서 사람들이 첫 rice에 쓰기 좋아하는 i3-gaps를 쓰기로 했다. 설치는 쉬우니 적당히 스킵

## 서피스 커널

Hibernate를 위해 기존 [jakeday 커널](http://github.com/jakeday/linux-surface) 대신 [`linux-surface/linux-surface`](https://github.com/linux-surface/linux-surface) 커널을 사용하기로 했다.

커널 패치는 어렵지 않게 [install guide](https://github.com/linux-surface/linux-surface/wiki/Installation-and-Setup)를 따라 패키지 설치 이후 부트로더에서 새 커널 엔트리를 만들었다.

새로 만든 `arch-surface` 엔트리 파일은 다음과 같다

```
title   arch-surface
linux   /vmlinuz-linux-surface
initrd  /intel-ucode.img
initrd  /initramfs-linux-surface.img
options initrd=initramfs-linux-surface.img root=PARTUUID={} rw
```

저번에 통수를 당한적이 있어서 확실히 했고 서피스 커스텀 커널로 부팅을 하고 `uname -a`로 결과를 확인하니 올바르게 패치된걸 알 수 있었다

```
$ uname -a
Linux {host} 5.5.10-arch1-1-surface ....
```

원래 안됐던 배터리도 물론 잘 보이고 서피스 펜도 마우스처럼 잘 인식되더라

![surface-pen-on-linux](./surface-pen-on-linux.jpg)

`surface` 커맨드로 키보드 분리, dgpu, 퍼포먼스 설정도 잘 된다
분리 리퀘스트를 날렸더니 윈도우처럼 똑 하고 분리되는데 이 시간을 더 빠르게 하려면 분리 daemon 을 설치하라고 하던데 나중에 해봐야겠음

![surface-latch](./surface-latch.png)

## locale

그리고 locale 문제로 삽질을 좀 했다. zsh의 labmda 테마를 기반으로 한 커스텀 테마를 사용하는데 람다 텍스트 `λ`가 복붙했을때는 아예 `?` 문자로 바뀌고 아니면 아예 다른 문자로 표시되는 locale 문제가 있었는데

컨피그 파일에서 `LANG`, `LC_ALL` 등을 수동으로 설정하니 그냥 터미널을 열면 텍스트가 안보이는데, 터미널에서 `urxvt` 커맨드로 수동으로 터미널을 여니까 텍스트가 보이는 현상이 있었다
이는 이전 설치에서도 겪었었던 문제였고 [다른 qna글](https://superuser.com/questions/509950/why-are-unicode-characters-not-rendering-correctly)에서 해결책을 겨우 찾았다. `localectl`로 설정해주니까 그때부터는 잘 되더라

터미널이 사람답게 표시되니까 너무 행복했다. (위 surface cli 스샷은 이 문제 해결한 뒤에 찍었음)

터미널은 urxvt를 쓰는데 원래도 urxvt에 letterspace 관련한 유니코드 캐릭터 표시 문제가 많아서 더 헤맸었지만 그래도 이게 제일 문제없이 잘 돌아서 맘에 든다. 테마는 기억이 잘 안나는데 임시로 `hyper-firewatch` 를 사용했던 것 같다.

적당히 설정해보니 쓸만한 정도는 된 것 같다. 다음엔 한글입력, bar config, 하드웨어 관련 설정과 발열, 배터리 드레이닝을 잡아보기로

![terminal](./neofetch.png)