---
title: Arch on Surface Book 2 - 3
date: 2020-03-30
description: 350만원짜리 리눅스랩탑 만들기
---

노트북의 사용성, 편의성에 집중해 작업했다. 본격적으로 최적화를 한다거나 그러지는 않았음

## 시간

리눅스는 하드웨어시간을 utc타임으로 설정하고 로컬타임을 타임존으로 계산하지만 윈도우는 하드웨어시간을 로컬타임으로 설정한다. 하지만 윈도우 설정을 바꿀 수 없어 리눅스에서 하드웨어 시간을 로컬타임으로 쓰게끔 해줘야 한다.


```sh
sudo timedatectl set-local-rtc 1
sudo hwclock --systohc --localtime
```

## 무선인터넷

원래 `netctl` 서비스만 enable 시켜서 잘 썼는데? 어느날부터 부팅할때 네트워크 서비스 시작에 오류가 생겨 보니까 두개 이상의 `netctl` 서비스가 시작되서 충돌이 났던 것
그래서 `netctl` 서비스 대신 `netctl-auto`를 이용하여 와이파이 연결을 자동화 했다.

하지만 이것 외에 문제가 있었다. 서피스 리눅스 커널의 고질적인 문제였는데 suspend 이후에 와이파이 드라이버가 내려가 수동으로 드라이버를 다시 로드시켜야 했다. suspend시 드라이버를 D3상태로 보내는게 배터리를 위한 일이라 어쩔 수 없다길래 [다른 사람들의 솔루션](https://github.com/jakeday/linux-surface/issues/369)을 빌려 sleep pre/post에 훅을 걸어 드라이버를 자동으로 내렸다 올리기로 했다.

```bash
#!/bin/sh

case "$1" in
    pre)
        modprobe -r mwifiex_pcie
        ;;
    post)
        # while [ $(cat /proc/acpi/button/lid/LID0/state | grep closed | wc -l) = 1 ]
        # do
        #     echo $(date) >> /var/log/resuspend
        #     echo freeze > /sys/power/state
        # done
        modprobe -r mwifiex_pcie
        modprobe -i mwifiex_pcie
        echo 1 > /sys/bus/pci/rescan
        ;;
esac
```

주석처리한 부분은 다른 유저가 올린 스크립트로, 원래 suspend가 서피스가 닫혀있을 때 일어나도 열리기 전까지 기다리는 스크립트인데 취향껏 꺼놨다.

## 한글 입력

저번에 nabi와 ibus를 썼는데 경험이 썩 좋지 않아서 uim을 쓰기로 했는데 정말 만족하고 있다. 왠만한게 다 상식적으로 작동하지만 단 한가지 단점은 한글상태인지 영어상태인지 내장 트레이 아이콘(`uim-toolbar-*`)이 아니면 전혀 알 수 없어서 너무 아쉽다. 내장 툴바는 환경이랑 잘 맞지 않아 쓰기 싫어서 그냥 한번 쳐보고 한글인지 영어인지 확인하기로 했다.

## acpi

노트북을 사용하면 꼭 있어야 하는 lid 열리고 닫힐 때, 그리고 파워 버튼이나 볼륨버튼, 화면 밝기 버튼 등의 이벤트 처리를 해야한다.

처음에는 파워버튼과 lid close 이벤트를 `logind` 에서 전부 suspend로 바꿨는데, 여기서는 lid open시 깨어나는걸 넣을 수 없어서 어쩔 수 없이 `logind` 에서 이벤트를 전부 ignore 시키고, acpi에서 이벤트를 처리하도록 했다.

`/etc/systemd/logind.conf`

```
[Login]
HandlePowerKey=ignore
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
...
```

`/etc/acpi/handler.sh`

```sh
case "$1" in
    button/power)
        case "$2" in
            PBTN|PWRF)
                systemctl suspend
                ;;
        esac
        ;;
    button/lid)
        case "$3" in
            close)
                systemctl suspend
                ;;
            open)
                echo "LID" > /proc/acpi/wakeup
                ;;
```

그리고 볼륨, 밝기 등의 `XF86*` 이벤트들은 전부 i3 에서 바인드해서 처리했다. 그런데 가끔 acpi 단에서 이걸 처리하는게 더 나았을텐데 하는 생각이 가끔 들어서 아마 곧 옮길 것 같다

## 터치패드

터치패드 기본 스크롤 방향이 반대여서 synaptics 드라이버 설정에서 스크롤 속도를 반대로 줬다. 또 탭을 클릭으로 가끔 써서 탭을 좌클릭, 손가락 두개 탭을 우클릭으로 설정을 했다.

`/etc/X11/xorg.conf.d/70-synaptics.conf`

```
Section "InputClass"
    Identifier "touchpad catchall"
    Driver "synaptics"
    MatchIsTouchpad "on"
    Option "TapButton1" "1"
    Option "TapButton2" "3"
	Option "VertTwoFingerScroll" "on"
	Option "HorizTwoFingerScroll" "on"
	Option "VertScrollDelta" "-80"
	Option "HorizScrollDelta" "-80"
```

그런데 문제가 생겼다. 타이핑하면서 손바닥으로 터치패드를 스쳐도 탭으로 인식이 되 자꾸 클릭을 하게 되는데 이게 너무 짜증났다. 윈도우에서는 당연히 잘 처리를 해줘서 몰랐던 건데

이걸 palm detection 이라고 하는 모양이더라. 그래서 [아치 위키](https://wiki.archlinux.org/index.php/Touchpad_Synaptics#Disable_touchpad_while_typing)에 나와있는대로 `PalmDetect`를 키고.. 했는데 그대로인거임

아래 warning 블록에 `For some touchpads, an issue with the kernel can cause the palm width to always be reported as 0` 라고 바로 있는걸 보고 바로 `evtest`를 돌려 확인을 했다

```shell
Event: time 1585532890.176268, type 3 (EV_ABS), code 57 (ABS_MT_TRACKING_ID), value -1
Event: time 1585532890.176268, type 1 (EV_KEY), code 330 (BTN_TOUCH), value 0
Event: time 1585532890.176268, type 1 (EV_KEY), code 325 (BTN_TOOL_FINGER), value 0
Event: time 1585532890.176268, -------------- SYN_REPORT ------------
Event: time 1585532890.305913, type 3 (EV_ABS), code 57 (ABS_MT_TRACKING_ID), value 1056
Event: time 1585532890.305913, type 3 (EV_ABS), code 55 (ABS_MT_TOOL_TYPE), value 0
Event: time 1585532890.305913, type 3 (EV_ABS), code 53 (ABS_MT_POSITION_X), value 1544
Event: time 1585532890.305913, type 3 (EV_ABS), code 54 (ABS_MT_POSITION_Y), value 1145
Event: time 1585532890.305913, type 1 (EV_KEY), code 330 (BTN_TOUCH), value 1
Event: time 1585532890.305913, type 1 (EV_KEY), code 325 (BTN_TOOL_FINGER), value 1
Event: time 1585532890.305913, type 3 (EV_ABS), code 0 (ABS_X), value 1544
Event: time 1585532890.305913, type 3 (EV_ABS), code 1 (ABS_Y), value 1145
Event: time 1585532890.305913, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 255500
Event: time 1585532890.305913, -------------- SYN_REPORT ------------
Event: time 1585532890.312911, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 262600
Event: time 1585532890.312911, -------------- SYN_REPORT ------------
Event: time 1585532890.319878, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 269700
Event: time 1585532890.319878, -------------- SYN_REPORT ------------
Event: time 1585532890.326919, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 276800
Event: time 1585532890.326919, -------------- SYN_REPORT ------------
Event: time 1585532890.334244, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 283900
Event: time 1585532890.334244, -------------- SYN_REPORT ------------
Event: time 1585532890.341287, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 291000
Event: time 1585532890.341287, -------------- SYN_REPORT ------------
Event: time 1585532890.349067, type 3 (EV_ABS), code 55 (ABS_MT_TOOL_TYPE), value 2
Event: time 1585532890.349067, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 298100
Event: time 1585532890.349067, -------------- SYN_REPORT ------------
Event: time 1585532890.354199, type 4 (EV_MSC), code 5 (MSC_TIMESTAMP), value 305200
Event: time 1585532890.354199, -------------- SYN_REPORT ------------
Event: time 1585532890.354215, type 3 (EV_ABS), code 57 (ABS_MT_TRACKING_ID), value -1
Event: time 1585532890.354215, type 1 (EV_KEY), code 330 (BTN_TOUCH), value 0
Event: time 1585532890.354215, type 1 (EV_KEY), code 325 (BTN_TOOL_FINGER), value 0
Event: time 1585532890.354215, -------------- SYN_REPORT ------------
```

아예 `PALM_*` 타입 (width 등)이 없더라 그래서 아예 안돌아감을 보임.. 이걸 드라이버 수동 패치를 해야하나 싶은데 일단은 보류하고 아예 `syndaemon`을 사용해 키보드 타이핑을 하는동안 터치패드 탭을 무시하는 방법을 사용하기로 했다

`.xinitrc`

```shell
...
syndaemon -i 1 -t -K -d
```

palm detect가 왜 안되는지 더 알아봐야 한다

## DE

쓸만하고 편안한 DE를 만들기 위해 많은 작업을 했다.

전체적인 구성은 `i3-gaps` 기반에 `i3bar + i3blocks`로 바 구성, 앱 런쳐로는 `rofi`에 notification daemon으로는 `dunst`를 사용한다.

### bar

conky같은걸 따로 안쓰다 보니 bar에서 최대한 많은 표시할 수 있는 정보를 간략하고 상태를 알 수 있게끔 설정을 해야 한다.

생각했던 표시해야하는 최소한의 정보는 다음과 같았다:

- 현재 시각
- 배터리
- cpu, 메모리 사용량
- cpu 온도
- 디스크 사용량
- 무선인터넷 연결 정보
- 볼륨, 밝기

그리고 당연히 배터리가 낮으면 위험하다고 경고를 해주는 등의 인디케이터가 있어야 한다.

그렇게 만들려다 보니 `i3status` 에서 내가 원하는 비주얼적인 기능이 부족해서 `i3blocks` 를 대신 사용하기로 하고, 위 정보들을 가져와서 디스플레이해주는 스크립트를 전부 손으로 작성해야 했다.

예를 들어 화면 밝기 스크립트는 다음과 같다.

```bash
#!/bin/bash

bright=$(brightnessctl -m | awk '{split($0,a,","); print substr(a[4],1,length(a[4])-1)}')

icons=("" "" "" "" "" "" "" "")

index=$(($bright * (${#icons[@]} - 1) / 100))
icon=${icons[$index]}

echo $icon $bright%
```

그리고 이에 비해 훨씬 대충 작성한 배터리 스크립트는 다음과 같다.

```bash
#!/bin/bash

statuses=($(acpi -b | awk '{print $3}' | sed 's/,//g'))
charges=($(acpi -b | awk '{print $4}' | sed 's/,//g' | sed 's/%//g'))
remains=($(acpi -b | awk '{print $5}'))
watt=$(cat /sys/class/power_supply/BAT$((1+$1))/power_now | awk '{printf("%2.1fW", $1*10^-6)}')

if [[ $1 -ge ${#statuses[@]} ]]; then
    echo "?  404 Not Found"
    echo "?  404 Not Found"
    echo "#aa759f"
    exit 0
fi

status=${statuses[$1]}
charge=${charges[$1]}
remain=${remains[$1]}

if [[ -z $remain ]]; then
    remain=""
else
    remain=" [${remain:0:${#remain}-3}]"
fi

if [[ $charge -lt 20 ]]; then
    icon=""
elif [[ $charge -lt 40 ]]; then
    icon=""
elif [[ $charge -lt 60 ]]; then
    icon=""
elif [[ $charge -lt 80 ]]; then
    icon=""
else
    icon=""
fi

if [[ $status == Discharging ]] || [[ $status == Unknown ]]; then
    if [[ $charge -lt 20 ]]; then
        color="#ac4142"
    elif [[ $charge -lt 60 ]]; then
        color="#f4bf75"
    else
        color="#90a959"
    fi
else
    color="#6a9fb5"
    icon="⚡${icon}"
fi

echo "${icon}  ${charge}% ${watt}${remain}"
echo "${icon}  ${charge}% ${watt}${remain}"
echo "$color"
```

배터리가 20% 이하면 빨간색, 60% 이하면 노란색으로 색 인디케이트를 해준다.

![bat2](./bat2.png)

그리고 서피스가 분리되어 배터리가 없을 때와 충전중일 때도 맘에 들게 꾸몄다.

![bat1](./bat1.png)

이런식으로 bar config는 하나하나 다 붙여서 다음 스크린샷처럼 나온다.

![i3](./i3.png)

오른쪽 위 `arch-on-surface/@20chan` 이 핵심이다. 가장 이쁨

하지만 i3bar는 온전한 bar가 아니라는 말이 있듯이 위/아래에만 위치할 수 있고 align은 무조건 오른쪽, 왼쪽은 workspace만 가능한게 너무 아까워서 언젠가? polybar 로 옮겨가지 않을까 싶다

저번에 polybar hidpi 설정에서 좀 다친적이 있어서 정말 polybar 쓸지는 잘 모르겠음

### lock

lock 은 가볍게 i3lock을 쓴다. 배경화면 블러 처리를 한 이미지를 사용하고, 시작할 때와 sleep에서 깨어났을 때 실행되는 스크립트도 추가했다.

그리고 tty1에선 자동로그인되서 바로 xwindow 로그인으로 넘어오는 설정도 getty tty1 오버라이드 서비스를 만들어 설정했다.

`/etc/systemd/system/getty@tty1.service.d/override.conf`

```
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin username --noclear %I $TERM
```

위에 `ExecStart=` 로 한줄 비워두는건 왤까? 궁금하지만 귀찮다.

### rofi

![rofi](./rofi.png)

윈도우+스페이스 단축키로 rofi run 런쳐를 실행한다. 테마는 `paper-float` 테마를 조금 수정한 버젼이다. 크게 다른건 없다

### dunst

붙여만 두고 아직 본격적으로 설정을 안했다. 윈도우 알림 관리보다 마음에 들게 만들 예정

## 오디오 노이즈

헤드폰을 꼽았을 때 스피커에서 노이즈가 생기는 오류가 있었다. 찾아보니 pulseaudio 문제였고
해결법은 alsamixer에서 `auto-mute mode`를 토글하는 것

## 외에

powertop 으로 슬쩍 봤는데 pulseaudio가 전력량 무지하게 잡아먹고 있어서 안쓰는동안 끄게끔 설정은 했는데 그래도 생각보다 오디오 사용시에 너무 배터리 사용이 빨라서 걱정이 된다. 제대로 뭔가 해보지는 않았지만 문제 인식만 된정도

처음부터 스왑파티션 설정을 잘 했었는데 hibernate는 여전히 안된다. 이건 좀 더 알아봐야 한다

듀얼 모니터 해상도 문제를 걱정했었는데, 생각보다 별 문제가 없었다. 서피스 해상도가 높아서 dpi를 크게 잡았더니 다른 모니터는 ui가 큼직큼직하게 나왔는데 xrandr에서 uiscale만 잡아주니 다른 모니터에서 ui가 적당한 크기로 나와서 똑같아졌다. 서피스 디스플레이 dpi를 96*2로, 서브모니터 uiscale를 2x2로 하면 보이는 ui 크기는 똑같아질 것

터치스크린은 싱글터치만 된다. 5.1+ 커널에서 멀티터치가 아예 안된다고 하더라

펜은 인식도 되고 그려지기도 하는데 압력과 지우개까지 되는지는 모르겠다. xournal 깔아서 테스트한번 해봐야 한다

vscode는 언제나 잘 작동한다. 걱정할 게 별로 없다

## todo

쓸만한 개발 머신이 된 것은 맞다. 하지만 아직은 부족하다

처음 정했던 목표들을 비교해보자

- [x] 부팅이 된다
- [x] 페이스북 메신저를 쓸 수 있다
- [x] c#을 IDE 도움을 받으면서 개발할 수 있다
- [ ] 어디에든 자랑스럽게 보여줄 수 있는 섹시한 테마로 커스터마이즈한다
- [ ] 펜을 사용해 편한 필기가 가능하다
- [ ] 배터리, 발열에 유의미한 최적화
- [ ] 예상치 않게 전원이 켜졌을 때 혼자 죽지 않아야 한다
- [ ] Hibernate 작동
- [ ] Secure Boot
- [ ] 분리한 상태로 영상 시청하는데 어려움이 없기 (NEW)

bar config를 꾸미며 색 하나하나를 raw color code로 넣어가면서 생각한게 적어도 이 컬러 theme만이라도 전체적으로 관리할 수 있게끔, 그리고 컬러 밖으로 여러 컨피그 파일도 쉽게 관리가 가능한 테마 매니저 스크립트를 만들고 싶다.

배터리, 발열은 내가 할 수 있는게 당장은 별로 없어 보이더라 그래도 일단 노력은 해봐야겠지

secure boot도 되게 하면 바로 할 수 있을 것 같고, hibernate는 좀 더 로그와 커뮤니티 뒤져가면서 노력해봐야한다

저번 실패했던 세팅과 달리 손에 잘 붙고 의도한대로 기능들이 움직이니까 훨씬 마음에 들고 굳이 윈도우로 부팅할 이유가 없어졌다. 이제 조금만 더 덕질을 하면 정말 자랑할만한 단계에 갈 수 있을 것 같다.

추가로, 그동안 잊고 있었지만 서피스북은 분리해서 들고 영상보는데 쓰고 싶었다. 분리된 상태에서 회전이나 터치로 사용하는데 큰 불편함이 없으면 좋겠는게 새로 추가된 목표이다.