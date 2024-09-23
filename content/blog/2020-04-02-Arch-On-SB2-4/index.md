---
title: Arch on Surface Book 2 - 4
date: 2020-04-02
description: 350만원짜리 리눅스 랩탑 만들기 - 사용성 개선
---

이번에는 진작 하고 싶었는데 미뤄뒀던 일들과 불편한 버그들을 해결했다.

저번에 설정했던 목표는 다음과 같았다.

- [x] 부팅이 된다
- [x] 페이스북 메신저를 쓸 수 있다
- [x] c#을 IDE 도움을 받으면서 개발할 수 있다
- [ ] 어디에든 자랑스럽게 보여줄 수 있는 섹시한 테마로 커스터마이즈한다
- [ ] 펜을 사용해 편한 필기가 가능하다
- [ ] 배터리, 발열에 유의미한 최적화
- [ ] 예상치 않게 전원이 켜졌을 때 혼자 죽지 않아야 한다
- [ ] Hibernate 작동
- [ ] Secure Boot
- [ ] 분리한 상태로 영상 시청하는데 어려움이 없기

## Palm Detection

저번에 synaptics 드라이버가 palm detection을 제대로 안해줘서 `syndaemon`을 사용했다고 했지만 여전히 자주 미스터치가 나서 너무 거슬려서 해결책을 빨리 찾아야 했다.

찾아보니 synaptics 드라이버 대신 libinput을 쓰면 문제가 해결된다고 한다. [아치 위키](https://wiki.archlinux.org/index.php/libinput#Via_Xorg_configuration_file)에 쓰여진 대로 libinput 드라이버가 먼저 로드되게끔 원래 사용하던 `/etc/X11/xorg.conf.d/70-synaptics.conf` 파일을 지우고 대신 그자리에 `40-libinput.conf` 파일을 넣어서 libinput이 내 터치패드를 핸들하게끔 설정해줬다.

```
Section "InputClass"
    Identifier "libinput touchpad catchall"
    MatchIsTouchpad "on"
    MatchDevicePath "/dev/input/event*"
    Driver "libinput"

    Option "Tapping" "on"
    Option "NaturalScrolling" "true"
    Option "AccelSpeed" "0.5"
EndSection
```

기존처럼 탶, 스크롤 방향, 그리고 스피드를 바꾸고 palm detection은 기본으로 설정되어 있어서 굳이 넣지 않았다. 이후로 한번도 미스터치가 난적이 없어서 너무 행복하다

## Secure Boot

언제나 굳이? 싶었던 secure boot 설정을 생각난김에 바로 해줬다. 방법은 두가지였는데, [linux-surface](https://github.com/linux-surface/linux-surface/wiki/Secure-Boot) 에서 사용하는 shim을 이용해 직접 커널 파일에 사인하는 방법과 [PreLoader](https://wiki.archlinux.org/index.php/Secure_Boot#PreLoader)을 사용하는 방법이었다. 전자가 마음에 들었지만 하던중 MokManager가 켜지지 않는 문제가 발생해서 어쩔 수 없이 프리로더를 사용해 쉽게 해버리기로 했다.

```bash
cp -r /boot/EFI EFI.backups
yay -S preloader-signed
sudo cp /usr/share/preloader-signed/* /boot/EFI/systemd
sudo mv /boot/EFI/systemd/systemd-bootx64.efi /boot/EFI/systemd/loader.efi
sudo mv /boot/EFI/systemd/PreLoader.efi /boot/EFI/systemd/systemd-bootx64.efi
reboot
```

그리고 시큐어부트를 키고, 해쉬툴로 `loader.efi` `vmlinuz-linux` `vmlinuz-linux-surface` 파일들을 해쉬돌리고 재부팅하니 바로 시큐어부트상태에서 부팅이 됐다.

하나 문제라면 사실 이전부터 아쉬웠던 건데 너무 최소한의 기능만 있는 `systemd-boot` 부트로더가 너무 작았던 건데 화면이 좀 더 작아졌길래 명시적으로 부트로더 컨피그 파일에서 최대한 크게 해줬더니 글씨가 기존처럼은 커졌다

```
timeout 3
default surface
console-mode max
```

나도 언젠가 `rEFInd` 로 갈아타고 싶다

## Hibernate

오랜 숙적이었던 Hibernation에 도전해보기로 했다.

일단 스왑파티션만 설정되어있는 상태에서 무작정 hibernate 상태에 진입하면 화면이 한번 꺼졌다 1초 뒤 다시 켜지고, 그리고는 노트북이 아예 꺼졌다. 그리고 부팅하면 아무일도 없었는데, 화면이 깜빡이는게 오류인 줄 알고 서피스 커널쪽에 문제가 있는게 아닐까? 하고 적당히 생각은 했지만 일단 [매뉴얼대로](https://wiki.archlinux.org/index.php/Power_management/Suspend_and_hibernate#Hibernation) 커널 설정을 해보기로 했다.

일단 스왑 파티션 사이즈는 16Gb로 잡아둬서 크게 문제가 없었고 swapon으로 확인을 해도 정상적으로 떠있길래 넘어갔다.
커널 파라미터로 `resume=PARTUUID={스왑 파티션 partuuid}` 를 추가했고 mkinitcpio 훅에 resume을 추가했다.

이후 `systemctl hibernate`로 바로 hibernate에 진입해봤고, 똑같이 화면이 깜빡하더니 전원이 꺼졌고, 다신 부팅하니 켜져있던 상태 마지막 화면(락 화면)에서 4초정도 프리징되어서 모든 입력이 안먹더다가 이후에 정상적으로 작동되더라

jakeday 커널에서는 hibernate가 안되서 그때부터 엄청 꿈꿔왔는데 생각보다 너무 쉽게 되버려서 너무 감격이었음 ㅠ

## mwifiex: module crashing

그리고 이쯤에서 문제가 터졌다. 이전 jakeday 커널로 작업할때는 엄청 흔하게 났던 문제이고 [고질적인 서피스 리눅스의 문제](https://github.com/linux-surface/linux-surface/wiki/Known-Issues)이기도 한 random wifi drop issue가 처음으로 발생했다.

원래는 power_save가 켜져있으면 와이파이 연결이 끊기는 문제도 겪어봐서 이건 미리 설정을 해뒀지만, 와이파이 드라이버가 멀쩡하게 사용하던 도중 갑자기 아예 떨어져 나가버리는 문제는 이번 설치 이후 처음이었다.

문제는 되게 심각해보였다. 아예 드라이버가 사라졌고, 재부팅하지 않는 한 어떻게 해도 복구가 불가능했다.

드라이버가 아예 사라져서 드라이버는 유선랜만 잡혔고

```console
λ ~/ ip link
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

수동으로 드라이버를 다시 불러오려 하면 아래와 같은 `mwifiex_cmd_timeout_func` 이후 크래시 로그가 떴다. 이 에러 내용으로 검색을 하면 비슷한 [서피스 기기에서 와이파이 드라이버가 갑자기 크래쉬난다는 이슈들](https://github.com/jakeday/linux-surface/issues/456)이 나온다.

```log
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: mwifiex_cmd_timeout_func: Timeout cmd id = 0xa4, act = 0x0
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: num_data_h2c_failure = 0
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: num_cmd_h2c_failure = 0
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: is_cmd_timedout = 1
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: num_tx_timeout = 0
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_cmd_index = 0
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_cmd_id: a4 00 1e 00 a4 00 7f 00 16 00
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_cmd_act: 00 00 00 00 00 00 00 00 00 00
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_cmd_resp_index = 4
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_cmd_resp_id: 16 80 1e 80 a4 80 7f 80 16 80
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_event_index = 3
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: last_event: 33 00 33 00 33 00 33 00 33 00
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: data_sent=1 cmd_sent=1
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: ps_mode=0 ps_state=0
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: ===mwifiex driverinfo dump start===
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: info: MWIFIEX VERSION: mwifiex 1.0 (15.68.19.p21) 
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PCIE register dump start
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: pcie scratch register:
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: reg:0xcf0, value=0xfedcba00
                           reg:0xcf8, value=0xad4124
                           reg:0xcfc, value=0x2121200

[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PCIE register dump end
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: ===mwifiex driverinfo dump end===
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: == mwifiex firmware dump start ==
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:17 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:19 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:21 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:21 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:21 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:21 2020] mwifiex_pcie 0000:01:00.0: failed to get signal information
[Tue Mar 31 15:43:21 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
[Tue Mar 31 15:43:21 2020] mwifiex_pcie 0000:01:00.0: PREP_CMD: FW is in bad state
```

원인은 [ASPM](https://en.wikipedia.org/wiki/Active_State_Power_Management) 때문이라고 [한다](https://github.com/linux-surface/linux-surface/wiki/Known-Issues#aspm-related-issue-s3-sp5-and-).

일단 확인해보니 ASPM이 켜져있기는 한 것 같더라

```console
λ ~/ journalctl -b | grep ASPM                         
Mar 31 15:05:01 archan kernel: acpi PNP0A08:00: _OSC: OS supports [ExtendedConfig ASPM ClockPM Segments MSI HPX-Type3]
```

그리고 이걸 끄는 방법은 되게 많았는데, 대부분 부트 직후 꺼버리는 스크립트였는데 커널 파라미터로 ASPM을 사용안하게 할 수 있다길래 그렇게 하기로 했다.

```
options pcie_aspm=off initrd=initramfs-linux-surface.img root=PARTUUID=...
```

그리고 재부팅하면 이렇게 ASPM이 꺼져있음을 확인할 수 있다.

```console
λ ~/ journalctl -b | grep ASPM                    
Mar 31 15:57:33 archan kernel: PCIe ASPM is disabled
Mar 31 15:57:33 archan kernel: acpi PNP0A08:00: _OSC: not requesting OS control; OS requires [ExtendedConfig ASPM ClockPM MSI]
```

이렇게 된 이후로 그렇게 오래 사용해본건 아니지만 아직까지 문제가 다시 발생하지는 않았다. 애초에 그렇게 흔하게 발생하는 문제가 아니어서 정말 문제가 해결되었는지는 계속 지켜봐야 하겠다.

## 스크린세이버

그리고 이전 서피스 리눅스 시도중 포기한 원인중 가장 큰 하나였던, 노트북이 사용중이 아닌데 랜덤으로 켜져서는 배터리가 다 닳기 전까지 발열하는 문제를 해결하고 싶었다.

일단 기존 리눅스 설정에서는 부팅 이후 부트로더를 지나 왠만하면 로그인 화면에서 멈춰있었다. 아니면 xwindow 환경에서 suspend가 풀려 켜져 있었거나
지금은 tty1에서 자동 로그인 이후 xwindow에서 로그인 락이 걸려있어서 x window에서 스크린 세이버만 잘 설정하면 두 경우가 다 해결이 될 것

일단 내가 원하는 시나리오는 다음과 같다

0. lid가 닫혀있을 때 suspend가 풀리면 lid가 열릴때까지 켜지기 않기
1. 5분 활동 없으면 화면 어둡게
2. 10분 활동 없으면 화면 꺼지기
3. 1시간 활동 없으면 suspend
4. 2시간 활동 없으면 hibernate

1번을 제외한 나머지를 해보자 나중에 하겠지

일단 0번은 쉬웠다. 저번에 sleep post 훅에 무선인터넷 드라이버 다시 로드하는 스크립트에서 주석처리했던 lid open까지 기다리는 부분을 주석 해제했다.

```bash
#!/bin/sh

case "$1" in
    pre)
        modprobe -r mwifiex_pcie
        ;;
    post)
         while [ $(cat /proc/acpi/button/lid/LID0/state | grep closed | wc -l) = 1 ]
         do
             echo $(date) >> /var/log/resuspend
             echo freeze > /sys/power/state
         done
        modprobe -r mwifiex_pcie
        modprobe -i mwifiex_pcie
        echo 1 > /sys/bus/pci/rescan
        ;;
esac
```

그리고 2번, 화면 꺼지기는 `xset`을 사용하고 3번 자동 suspend는 `xautolock`을 사용하고 4번은 `suspend-then-hibernate`를 사용하면 되겠다.

설정은 어렵지 않았다. xset 에서는 이미 10분뒤 화면이 꺼지는게 기본값이더라.

```console
λ ~/ xset -q
...
Screen Saver:
  prefer blanking:  yes    allow exposures:  yes
  timeout:  600    cycle:  600
Colors:
  default colormap:  0x20    BlackPixel:  0x0    WhitePixel:  0xffffff
Font Path:
  /usr/share/fonts/TTF,built-ins
DPMS (Energy Star):
  Standby: 600    Suspend: 600    Off: 600
  DPMS is Enabled
  Monitor is On
```

스크린세이버와 DPMS가 둘 다 켜져있는데 [둘의 차이점](https://bbs.archlinux.org/viewtopic.php?id=203762)은 크게 없는 것 같고 DPMS의 standby, suspend, off 셋 다 깨어나는 시간이 다르지 않아서 적당히 넘어가기로 했다.

다음은 xautolock으로 1시간 활동이 없으면 `suspend-then-hibernate`를 실행하는 것
`.xinitrc`에 다음 코드를 추가했다

```bash
pidof -s xautolock >& /dev/null
if [ $? -ne 0 ]; then
    xautolock -time 60 -locker "systemctl suspend-then-hibernate" &
fi
```

그리고 `suspend-then-hibernate` 에서의 suspend 되고 나서 hibernate 되기까지의 시간을 1시간으로 `/etc/systemd/sleep.conf` 에서 설정을 해줬다.

```
[Sleep]
...
HibernateDelaySec=60min
```

마지막으로 기존 파워버튼, 그리고 i3에서 설정한 suspend 단축키 등의 활동을 `suspend`에서 `suspend-then-hibernate`으로 전부 바꿔줘서 xwindow 환경에서 계속 켜져 있는채로 배터리를 먹는 일은 없도록 했다. 실제로 오늘 아침에 출근하고 서피스를 켜니 가방 안에 들어있는 상태에서 파워가 눌렸는지 리드를 열자마자 suspend 상태에서 깨어나던데 배터리가 100%에서 얼마 닳지도 않은걸 보니 너무 행복했다.

하지만 문제가 하나 남긴 했다. 정말 어이없는 경우인데, 부팅 이후 부트로더에서 타임아웃이 지나 디폴트 선택으로 이 커널로 들어온다는 전제하에 이 파워 매니저는 잘 작동한다. 만약 부트로더에서 실수로 키보드가 눌려 (닫혀 있는 상태에서 이게 가능하기는 할까?) 커널 선택 단계에서 멈춰버린다면 답이 없다. 충분히 무시가능한 케이스지만 혹시나 하는 마음이 남아있기는 함

## wakelock

그리고 suspend와 같은 sleep 상태에서 깨어날 때 락을 걸어주는 `wakelock` 서비스를 저번에 추가했었다. 그런데 작업하다 알게된 `xss-lock`이 이런 작업을 쉽게 해주는 거 같아서 갈아타기로 했다.

기존 내가 만들었던 `wakelock` 서비스를 disable하고, i3 config에 있는 xss-lock 관련 스크립트를 내 lock 스크립트로 교체했다

```bash
exec --no-startup-id xss-lock -- ~/.local/bin/lock
```

딱히 바뀐것도 없는거 같아서 좋다

추가로 락스크린 커스터마이징도 하고 싶었지만 i3lock은 전혀 그런 커스터마이징을 지원하지 않아 그냥 포기했는데, 시계만큼은 너무 넣고 싶어서 결국 i3lock의 fork중 하나인 [`i3lock-color`](https://github.com/Raymo111/i3lock-color/) 을 i3lock 대신 사용하기로 했다. 당장은 시계를 **보이게만** 했지만 나중에 커스터마이징 덕질을 제대로 시작하면 이쁘게 잘하겠지

![i3lock-color](./i3lock-color.png)

## todo

- [x] 부팅이 된다
- [x] 페이스북 메신저를 쓸 수 있다
- [x] c#을 IDE 도움을 받으면서 개발할 수 있다
- [ ] 어디에든 자랑스럽게 보여줄 수 있는 섹시한 테마로 커스터마이즈한다
- [ ] 펜을 사용해 편한 필기가 가능하다
- [ ] 배터리, 발열에 유의미한 최적화
- [x] **예상치 않게 전원이 켜졌을 때 혼자 죽지 않아야 한다**
- [x] **Hibernate 작동**
- [x] **Secure Boot**
- [ ] 분리한 상태로 영상 시청하는데 어려움이 없기

이제 평범한 노트북으로써 쓰기에 전혀 어색하거나 불편한게 없는 상태까지는 온 것 같다

cpu 발열은 평상시 작업할때에나 유투브볼때도 38~50도를 유지해서 적당히 따끈따끈한데 이게 윈도우를 쓸 때에도 이정도로 뜨거웠나? 싶다 가끔 빌드돌리면 70도까지 올라가기도 하지만 이정도는 어쩔 수 없을 것 같고 암튼 적당히 잡을 수 있으면 좋겠다

배터리는 2시간 밝기 20%으로 작업하면 80%정도가 된다. 어제는 밝기 25%정도로 6시간정도 문제없이 사용하고 배터리가 20%정도 남았나? 크게 문제가 있을 정도로 심각하지는 않고 급하지도 않아서 천천히 볼 예정

이제 쉽게 테마, 설정을 바꿀 수 있고 정보를 수집할 수 있게 작업을 하는 것에 집중을 할 예정이다