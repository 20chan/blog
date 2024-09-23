---
title: Arch on Surface Book 2 - 1
date: 2020-03-21
description: 350만원짜리 리눅스랩탑 만들기
---

작년 8월에 서피스북2에 아치리눅스를 윈도우와 듀얼부트할 수 있게 설치를 하고 세팅을 해본적이 있다. 가끔 혼자서 켜졌을 때 배터리가 0퍼가 될때까지 화면이 켜져있거나, 배터리 드레이닝 이슈가 심해서 결국엔 지웠지만 확실히 뽕맛은 쩐다

[그때의 일지를 이슈](https://github.com/20chan/surface-arch/issues)로 정리한게 있지만 자세한 노가다 로그를 정리해두지 않아서 아쉬웠는데 이번에 또 뽐뿌가 와서 도전해보려고 한다. 그래서 이 삽질 로그를 적당히 준비하는게 목표이다

## 목표

저번 서피스북에 리눅스 설치하고 세팅하기의 목표와 진행사항은 다음과 같았다.

 - [x] 부팅이 된다
 - [x] 몇몇 기능이 안되지만 그래도 신경쓰면서 사용가능
 - [x] 평범한 노트북처럼 사용할 수 있다
 - [ ] 최고의 개발 환경을 설정해서 손가락으로 오르가즘을 느낀다
 - [ ] 룩덕질로 행복해 뒤진다

리눅스 설치, 듀얼부팅, 그리고 커스텀 커널 패치와 간단한 DE 설정과 조금의 커스터마이징이 되었지만, openbox의 구린 타일링 지원, 배터리 문제와 발열, 오디오 성능과 불편함때문에 포기했지만 굳이 리눅스 위에서 할일이 없었기에 의욕이 없었기도 했다. 이번엔 좀 더 확실한 목표를 정하고 이를 이뤄내는 것으로 한다

- [ ] 부팅이 된다
- [ ] 페이스북 메신저를 쓸 수 있다
- [ ] c#을 IDE 도움을 받으면서 개발할 수 있다
- [ ] 어디에든 자랑스럽게 보여줄 수 있는 섹시한 테마로 커스터마이즈한다
- [ ] 펜을 사용해 편한 필기가 가능하다
- [ ] 배터리, 발열에 유의미한 최적화
- [ ] 예상치 않게 전원이 켜졌을 때 혼자 죽지 않아야 한다
- [ ] Hibernate 작동
- [ ] Secure Boot

생각보다 작업이 꽤 필요하다 특히 지금의 윈도우 이상으로 편안함을 끌어올려 굳이 윈도우를 부팅하고 싶지 않게 만들고 싶다.

계기는 그냥 이쁜 리눅스 DE 보다 감성터져서

## 설치

듀얼부팅까지의 작업은 크게 보통 설치 USB -> 파티션 분리 -> 설치 의 순이다. 이 작업들은 그 무엇보다 [arch wiki](https://wiki.archlinux.org/index.php/installation_guide)에 잘 설명되어있고 또 서피스북같은 UEFI 모드에서 설치도 다 잘 나와 있어서 자세한건 생략하고 넘어감

대부분은 이 두 글([1](https://gist.github.com/johnramsden/f873723150209ccc4533f43ef100e9da), [2](https://github.com/linux-surface/linux-surface/wiki/Installation-and-Setup))을 참고해서 대부분 똑같음

일단 설치를 진행한 2020년 3월 12일 기준 최신 아치 리눅스 커널 버젼 5.5.6을 USB에 잘 넣고 USB로 부팅해 파티션 작업을 했다.
미리 리눅스에 사용할 공간 100GB정도를 윈도우에서 줄여놓고 왔다.

```
$ lsblk
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
loop0         7:0    0 534.8M  1 loop /run/archiso/sfs/airootfs
sda           8:0    1  14.3G  0 disk /run/archiso/bootmnt
├─sda1        8:1    1   651M  0 part 
└─sda2        8:2    1    64M  0 part 
nvme0n1     259:0    0   477G  0 disk 
├─nvme0n1p1 259:1    0   260M  0 part 
├─nvme0n1p2 259:2    0   128M  0 part 
├─nvme0n1p3 259:3    0   378G  0 part 
└─nvme0n1p4 259:4    0   980M  0 part 
```

gdisk를 이용해 다음과 같이 루트, 홈, 부트, 스왑 파티션을 만들었다

```
Number  Start (sector)    End (sector)  Size       Code  Name
   1            2048          534527   260.0 MiB   EF00  EFI system partition
   2          534528          796671   128.0 MiB   0C01  Microsoft reserved ...
   3          796672       793405439   377.9 GiB   0700  Basic data partition
   4       793405440       826959871   16.0 GiB    8200  Linux swap
   5       826959872       889874431   30.0 GiB    8304  Linux x86-64 root (/)
   6       889874432      1000215182   52.6 GiB    8302  Linux /home
```

그리고 각 파티션에 ext4과 스왑 등을 굽고 /mnt, /mnt/home, /mnt/boot 등에 마운트를 시키고

```
$ lsblk
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
loop0         7:0    0 534.8M  1 loop /run/archiso/sfs/airootfs
sda           8:0    1  14.3G  0 disk /run/archiso/bootmnt
├─sda1        8:1    1   651M  0 part 
└─sda2        8:2    1    64M  0 part 
nvme0n1     259:0    0   477G  0 disk 
├─nvme0n1p1 259:1    0   260M  0 part /mnt/boot
├─nvme0n1p2 259:2    0   128M  0 part 
├─nvme0n1p3 259:3    0   378G  0 part 
├─nvme0n1p4 259:4    0    16G  0 part [SWAP]
├─nvme0n1p5 259:11   0    30G  0 part /mnt
└─nvme0n1p6 259:12   0  52.6G  0 part /mnt/home
```

이렇게 디스크는 준비가 다 됨

이제 무선 인터넷 연결, pacman 미러리스트설정을 하고 나서 pacstrap, genfstab 등을 돌린다
근데 여기서 fstab 파일에서 이상하게 /mnt/boot에 마운트된 /dev/nvme0n1p1 이 write-enable이 아니어서 수동으로 바꿨다

이후에는 chroot 이후 로컬타임, locale-gen, host 설정을 하고 무선인터넷 연결을 위해 애용하는 wpa와 wifi-menu, dialog를, 외엔 sudo, zsh를 설치하고 sudoer 설정도 해준 뒤

그리고는 `mkinitcpio -p linux` 로 리눅스 빌드, `passwd`로 패스워드 설정까지 다 똑같다
대신 문제가 좀 생겼던 부분이 여기다

이제 부트로더를 설정해야 한다. 저번에 `grub`에 당해서 이번에는 `systemd-boot`를 사용해보려고 한다. 근데 이래놓고 언젠가는 결국 `grub`쓰러 가겠지

먼저 `intel-ucode`로 intel microcode를 설치해주고 `bootctl --path=/boot install` 로 부트로더 설정도 해주고 부트로더 파일을 세팅해준다

```
$ cat /boot/loader/entries/arch.conf
title Arch
linux /vmlinuz-linux
initrd /intel-ucode.img
options root=PARTUUID={} rw
```

이상태로 부트로더 설정을 끝내고 chroot 탈출하고 언마운트하고 부팅을 했는데 커널 패닉이 떠서 실행이 안되더라

```
[   0.338783] DMAR: [Firmware-Bug]:j No firmware reserved reggion can cover this
RMRR [0x0000000003e2e0000-0x0000000003e2ffffff], contact BIOS vendor for fixes
[   1.242837] Kernel panic - not syncingg: VFS: Unable to mount root fs on unknown-block(259,5)
[   1.243057] CPU: 5 PID: 1 Comm: swapper/0 Tainted: G  I   5.5.8-arch1-1 #1
[   1.xxxxxx] Hardware name: Microsoft Corporation Surface Book 2, BIOS 389.2837.768 08/21/2019
[   1.xxxxxx] Call Trace:
[   1.xxxxxx]  dump_stack+0x66/0x90
[   1.xxxxxx]  mount_block_root+0x31c/0x32b
[   1.xxxxxx]  prepare_namespace+0x136/0x165
[   1.xxxxxx]  ? rest_init+0xbf/0xbf
[   1.xxxxxx]  kernel_init+0xa/0x101
[   1.xxxxxx]  ret_from_fork+0x35/0x40
[   1.xxxxxx] Kernel Offset: 0xc00000 from 0xffffffff81000000 (relocation range: 0xffffffff780000000-0xffffffffbfffffff)
[   1.xxxxxx] ---[ end Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(259, 5) ]---
```

이걸로 일주일동안 삽질을 했다. 대충 root를 마운트시키는데 오류가 생겼다는 것이고, 수많은 커뮤니티를 뒤져서 알아낸 건 다음과 같았다.

unknown-block 부분에서 (259, 5)는 5번째 파티션인 `/dev/nvme0n1p5`에 259블럭을 씌우는데 실패했다는 것. 문제는 보통 사람들은 저 문제가 되는 파티션이 `unknown-block(0,n)` 으로 나와 아예 파티션 설정 자체를 잘못했거나 오타가 나서 발생하는데, 나는 그게 아닌 다른 문제라는 것

물론 usb로 부팅해서 설치 라이브에서는 마운트하는데 아무 문제가 없었고, 그리고 며칠간은 저 블럭 문제에서 눈치를 못채고 fstab 파티션 설정 문제인줄 알고 정말 여러 삽질을 했지만 결론은 파티션 자체에는 문제가 없었기에 마운트되는 도중 문제가 생겼던 것이고, 그 문제는 전혀 다른 것이었음

답변이 어디서 나왔는지 기억은 나지 않는다. 어떤 설치 가이드에서도 나와있지 않지만 `initrd`를 명시적으로 한번 더 표시해줬어야 했다. 결국 부트로더 컨피그 파일을 다음으로 수정했다.


```
title Arch
linux /vmlinuz-linux
initrd /intel-ucode.img
initrd /initramfs-linux.img
options initrd=initramfs-linux.img root=PARTUUID={} rw
```

아니 근데 분명 예전에는 저렇게 `initramfs-linux.img` 파일을 추가로 말 안해도 됐었는데.. 가이드보고 따라하면서 문제 없었는데 이번에는 아니어서 너무 헤맸다

## 부팅 이후 무선인터넷
부팅에는 성공했지만 이번에는 완전 또 다른게 문제가 생겼다.
무선인터넷이 연결이 아예 안되서 5시간정도 삽질을 했다. dmesg로 메시지를 다 뒤져보면 계속 와이파이에 연결하자마자 `successfully disconnected reason code 3` 만 떠서 찾아보니 딱히 해결책도 안보이고

그러다가 `journalctl -xe` 에서 우연히 본 에러메시지가 아마 `dhcp` 패키지가 설치 안되서 그랬단걸 알았다. 다시 usb 라이브로 설치하고 부팅해서 netctl로 무선인터넷 자동 연결까지 겨우 설정했다.

## 다음

암튼 이렇게 해서 정상적으로 리눅스/윈도우 듀얼 부팅까지 설정을 마쳤다. 부팅에 막혀서 일주일간 집에 쳐박아놔서 시작부터 여기까지 꼬박 9일이나 걸렸다.

다음에는 i3와 함께 xwindows 설정과 관련된 이슈를 해결하여 간단한 DE 설정을 해보는 걸로

재밌게보셨다면 구독과좋아요댓글부탁드려요