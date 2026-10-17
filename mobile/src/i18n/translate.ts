import burmese from "./my.json";
const dictionary: Record<string, string> = burmese;
const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^(\d+) min ago$/, (m) => `${m[1]} မိနစ်အကြာ`],
  [/^(\d+) hours? ago$/, (m) => `${m[1]} နာရီအကြာ`],
  [/^(\d+) days? ago$/, (m) => `${m[1]} ရက်အကြာ`],
  [/^(\d+) weeks? ago$/, (m) => `${m[1]} ပတ်အကြာ`],
  [/^(\d+) months? ago$/, (m) => `${m[1]} လအကြာ`],
  [/^(\d+) years? ago$/, (m) => `${m[1]} နှစ်အကြာ`],
  [/^(\d+) followers$/, (m) => `Follow လုပ်ထားသူ ${m[1]} ဦး`],
  [/^Ingredient (\d+)$/, (m) => `ပါဝင်ပစ္စည်း ${m[1]}`],
  [/^Selected photo (\d+)$/, (m) => `ရွေးထားသော ဓာတ်ပုံ ${m[1]}`],
  [/^Remove photo (\d+)$/, (m) => `ဓာတ်ပုံ ${m[1]} ဖယ်ရှားရန်`],
  [/^Post photo (\d+)$/, (m) => `ပို့စ်ဓာတ်ပုံ ${m[1]}`],
  [/^Photo (\d+) of (\d+)$/, (m) => `ဓာတ်ပုံ ${m[1]} / ${m[2]}`],
  [/^Remove (\d+)$/, (m) => `${m[1]} ကို ဖယ်ရှားရန်`],
  [/^View (.+)'s profile$/, (m) => `${m[1]} ၏ ကိုယ်ရေးစာမျက်နှာ ကြည့်ရန်`],
  [/^(.+)'s profile$/, (m) => `${m[1]} ၏ ကိုယ်ရေးစာမျက်နှာ`],
  [/^(.+)'s photo$/, (m) => `${m[1]} ၏ ဓာတ်ပုံ`],
  [
    /^What’s on your mind, (.+)\?$/,
    (m) => `${m[1]}၊ ဘာအကြောင်း မျှဝေချင်ပါသလဲ?`,
  ],
  [/^No posts found$/, () => "ပို့စ် ရှာမတွေ့ပါ"],
  [/^No users found$/, () => "အသုံးပြုသူ ရှာမတွေ့ပါ"],
  [
    /^Uploading photo (\d+) of (\d+)…$/,
    (m) => `ဓာတ်ပုံတင်နေပါတယ် ${m[1]} / ${m[2]}…`,
  ],
  [/^Date of birth: (.+)$/, (m) => `မွေးသက္ကရာဇ်: ${m[1]}`],
  [
    /^(Block|Mute|Unblock|Unmute) (.+)\?$/,
    (m) => `${m[2]} ကို ${dictionary[m[1]] ?? m[1]}မလား?`,
  ],
];
/** Translate only UI labels explicitly passed here; user posts, names and AI replies stay untouched. */
export function translate(text: string, language: "en" | "my") {
  if (language === "en") return text;
  if (dictionary[text] !== undefined) return dictionary[text];
  for (const [expression, format] of patterns) {
    const match = text.match(expression);
    if (match) return format(match);
  }
  return text;
}
export function notificationMessage(
  item: { type: string; message: string; data: unknown },
  language: "en" | "my",
) {
  if (language === "en") return item.message;
  const data = item.data as { actor?: { name?: unknown } } | null;
  const name = typeof data?.actor?.name === "string" ? data.actor.name : null;
  if (!name) return translate(item.message, language);
  switch (item.type) {
    case "FOLLOW":
      return `${name} က သင့်ကို follow လုပ်ထားပါတယ်။`;
    case "LIKE":
      return `${name} က သင့်ပို့စ်ကို နှစ်သက်ထားပါတယ်။`;
    case "COMMENT":
      return `${name} က သင့်ပို့စ်မှာ မှတ်ချက်ရေးထားပါတယ်။`;
    case "SHARE":
      return `${name} က သင့်ပို့စ်ကို မျှဝေထားပါတယ်။`;
    default:
      return translate(item.message, language);
  }
}
