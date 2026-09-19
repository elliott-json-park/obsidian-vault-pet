# Vault Pet

**A pixel pet that grows as you write.** Every character you type, link you make and note you create is food for it. It hatches from an egg and grows into an adult. While you type it writes along in a little notebook, it cheers when you link two notes, and it reminds you about lunch, breaks and bedtime.

Most pet plugins just sit there. This one only grows when your vault does.

![While you write, the pet in the corner of the editor scribbles in its notebook and reacts to a new link. The pet house is open in the right sidebar.](docs/overview.png)

*Screenshots show the Korean UI. The plugin speaks English and Korean and follows Obsidian's language.*

## Features

- **Grows from your writing**: egg → baby → kid → teen → adult, with levels in between
- **Lives on your screen**: a small pet in the corner of the editor that you can pet, drag, and put to sleep
- **Reacts to what you do**: writes along while you type, jumps when you add a link, waves at a new note, celebrates every 1,000 characters a day
- **Looks after you**: lunch and dinner reminders, a stretch after 90 minutes without a break, a nudge to go to bed after 1 AM
- **Game layer**: 3 daily quests, 26 badges, daily streaks, 11 accessories and 6 body colors to unlock
- **Pet house** in the sidebar with quests, badges, wardrobe and writing stats
- **Pet card** you can drop into any note with a `vault-pet` code block
- **Private**: note contents are never stored or sent anywhere. No network access

## How XP works

```
XP    = characters written ÷ 20 + links × 5 + new notes × 15 + bonus
Level = √(XP / 25) + 1
```

| Stage | XP needed |
|---|---|
| 🥚 Egg | 0 |
| 🐣 Baby | 1,000 |
| 🌿 Kid | 8,000 |
| ✨ Teen | 30,000 |
| 👑 Adult | 100,000 |

What counts:

- **Characters**: text without spaces, Markdown symbols, URLs or frontmatter. Code counts too.
- **Links**: `[[wikilinks]]`, `![[embeds]]` and `[markdown](links)`, but not the ones inside code or `%%comments%%`.
- **New notes**: a note counts once it has at least 10 characters.

What doesn't count, so you can't farm XP:

- **Only new highs count.** For every file the plugin remembers the most characters and links it has ever had, and only growth past that earns XP. Deleting and retyping, undo/redo or cut and paste won't earn anything.
- **Pastes are capped** at 3,000 characters and 30 links per file per change.
- **Bulk changes are capped.** Copying a folder of notes in, or a sync touching dozens of files, earns at most 6,000 characters, 60 links and 10 notes per burst. Changes made while Obsidian was closed earn at most 20,000 characters the next time it starts.
- **Ignored entirely**: Excalidraw drawings, inline image data (`data:` URIs), single lines over 1,000 characters inside code blocks (data blobs), and any folders you exclude in the settings (templates, attachments…).

**Starting point.** The welcome tour asks how to start, and you can change it later in the settings:

- **Count everything I've written**: on first run the vault is read once and your notes are filed under the day they were created. A big vault may start as a teen.
- **Start from an egg**: only what you write from now on counts.
- **Start at a stage I pick**: start at that stage's XP, then grow with what you write.

Restarting keeps your badges and items.

## Playing with your pet

The pet sits in the bottom-right corner of the editor. Until you move it, it follows that corner as sidebars open and close.

| Action | What happens |
|---|---|
| Click | Pet it (hearts) |
| Drag | Move it (the spot is remembered) |
| Double-click | Open the pet house |
| Right-click | Pet, open house, quiet for 1 hour, reset position, hide |
| Hover | Level, progress to the next stage and today's writing |
| Click a bubble | Jumps to the badge, quest or wardrobe tab it's about |

Clicks on the transparent parts of the pet go through to whatever is behind it. When XP comes in, `+12 XP` floats up over its head.

**Moods**

| Mood | When | Looks like |
|---|---|---|
| ✍️ Writing with you | You typed in the last 20 seconds | Opens a notebook and scribbles, letters float up |
| 👀 Watching | Any activity in the last 5 minutes, including opening notes | Bounces and looks around |
| 🍃 Lazing | 5–20 minutes idle | Breathes slowly |
| 😪 Sleepy | 20–45 minutes idle | Half-closed eyes, yawns |
| 💤 Asleep | 45+ minutes idle | Flattens out, Zzz |

All the timings can be changed in the settings. As an egg it can't talk yet, so it only wiggles: `(wiggle wiggle)`.

**Quiet mode** (right-click, command palette or the house) silences bubbles and sounds for an hour.

## Game layer

- **Daily quests**: three new ones every midnight, drawn from writing, linking, new notes, opening notes, petting, taking a break, having lunch and starting before 10 AM. They pay out the moment they're done, and clearing all three adds +100 XP.
- **26 badges**: totals for characters, links and notes, a hub note with 20 backlinks, 3,000 characters in a day, streaks, night owl and early bird, marathons, meals, breaks, petting, quests, levels and stages. On first run, badges your existing notes already earned are awarded quietly all at once.
- **Streak**: the first thing you do in Obsidian each day pays `20 + streak days × 5` XP (up to 90).
- **11 accessories**: sprout pin, ribbon, glasses, headphones, beanie and scarf unlock with levels. The quill, nightcap, party hat, chef hat and crown unlock with badges.
- **6 colors**: violet (default), clay, mint and peach unlock with levels. Midnight (1,000 links) and gold (1,000,000 characters) unlock with badges.
- **Sound effects**: tiny 8-bit jingles for level-ups, badges, evolutions and links. You can turn them off.

## Pet house

Open it from the paw icon in the ribbon, the level in the status bar (`✨ Lv.40 · 31%`), or by double-clicking the pet.

![Quests, badges, wardrobe and stats tabs](docs/tabs.png)

- **Home**: today's characters, links and new notes, your streak, the growth roadmap, play buttons and recent bonus XP
- **Quests**: today's quests and the time until new ones
- **Badges**: when each badge was earned, or how close you are
- **Wardrobe**: colors and accessories. New unlocks are marked `NEW`
- **Stats**: characters per day for the last 14 days, when you write, all-time totals, where your XP came from, and the notes with the most backlinks (click one to open it)

## Pet card in a note

Put this code block in any note to get a live pet card there. The **Insert pet card** command adds it for you. It works well on a home note or in a daily note template.

````markdown
```vault-pet
```
````

![A pet card inside a note: name, level, mood, progress to the next stage and today's writing](docs/card.png)

## Commands

| Command | |
|---|---|
| Open pet house | |
| Show or hide the pet | A hidden pet still appears in the house and in note cards |
| Pet the pet | |
| Toggle quiet mode for 1 hour | |
| Reset pet position | |
| Insert pet card | Inserts a `vault-pet` code block into the current note |

## Settings

Name, language (auto, English, 한국어), show on screen, size (×1–×5), status bar, pixel font, speech bubbles, small talk, sound, lunch and dinner times, break, sleepy and sleep timings, late-night nagging, starting point, folders to ignore, the welcome tour, reset position, recount from scratch, and erase everything.

## Installation

From **Settings → Community plugins → Browse**, search for **Vault Pet**.

Manual install: copy `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<your vault>/.obsidian/plugins/vault-pet/`, then enable **Vault Pet** under Community plugins.

**Optional pixel font.** The UI can use the [Galmuri](https://github.com/quiple/galmuri) pixel font. Obsidian only installs the three files above, so by default the pet uses your theme's font. If you want the pixel look, copy the `fonts/` folder from this repository into the same plugin folder. The plugin picks it up on its own, and the **Pixel font** setting turns it on and off.

![Welcome tour: a new friend has arrived](docs/welcome.png)

## Privacy

- Notes are only ever **read**. Their contents are never stored or sent anywhere.
- Why it lists every Markdown file: on first run it reads your notes once to count what you've already written, and at startup it checks which notes changed while Obsidian was closed (by modification time, so unchanged notes aren't read again). Folders you exclude in the settings are skipped.
- All the plugin keeps is, per file path, the highest character and link counts, plus daily and hourly totals. Everything lives in `.obsidian/plugins/vault-pet/data.json`.
- No network access.

## Development

No build step. The plugin is a single `main.js`.

```bash
node tests/run.js                          # logic tests without Obsidian (counting, ledger, growth, quests, badges, moods, both languages)
node scripts/demo-vault.js <folder>        # a demo vault on first run (welcome tour and an egg)
node scripts/demo-vault.js <folder> --seeded   # a pet raised for about three weeks (used for the screenshots)
node scripts/demo-vault.js <folder> --plugin-only  # copy the plugin files only, leave the notes alone
```

```
main.js
  language       S (UI strings as [Korean, English]), LINES (pet lines)
  counting       measure(): characters and links in a note
  ledger         Ledger: per-file highs, daily and hourly totals, budgets for bulk changes
  growth         computeGrowth(): XP → level and stage
  mood           Brain: moods, reminders, reactions to writing
  game           Gamify: quests, badges, streaks, items, colors, bonus XP
  pixel art      PetRenderer: the pet is drawn in code on a 48×48 canvas
  sound          PetSound: WebAudio square waves
  UI             PetWidget (floating pet), HouseView (sidebar), PetCard (in notes), WelcomeModal, PetSettingTab
styles.css       pixel-style UI on top of your theme's colors. The accent follows the pet's color
fonts/           Galmuri pixel font (SIL OFL 1.1), optional
```

The pet started as Claude Pet, a desktop companion that grows with Claude Code usage. Vault Pet brings it into Obsidian and feeds it your notes instead.

## 한국어 안내

노트를 쓸수록 자라는 도트 펫이에요. 글자를 쓰고(20자 = 1XP), 링크를 걸고(5XP), 새 노트를 만들면(15XP) 경험치가 쌓여 알에서 어른까지 자라요. 쓰는 동안 옆에서 공책에 같이 받아 적고, 링크를 걸면 폴짝 뛰고, 점심·휴식·잘 시간을 챙겨줘요. 일일 퀘스트 3개, 업적 26개, 출석, 꾸미기 11종과 몸 색깔 6종이 있어요.

- 파일마다 가장 많았던 글자·링크 수보다 늘어난 만큼만 세서, 지웠다 다시 쓰기로는 오르지 않아요. 붙여넣기와 한꺼번에 들어온 변경에도 상한이 있어요.
- 처음 켤 때 "지금까지 쓴 노트 전부 반영 / 알부터 / 원하는 단계부터" 중에서 고를 수 있어요.
- 노트에 `vault-pet` 코드 블록을 넣으면 그 자리에 펫 카드가 떠요.
- 노트 내용은 저장하지도 보내지도 않아요. 경로별 숫자와 날짜별 합계만 `data.json` 에 남아요.
- 도트 글꼴(갈무리)을 쓰려면 이 저장소의 `fonts/` 폴더를 플러그인 폴더에 복사하세요. 없으면 테마 글꼴로 보여요.

## License

MIT. The optional pixel font is [Galmuri](https://github.com/quiple/galmuri) under the SIL Open Font License 1.1 (`fonts/OFL.md`).
