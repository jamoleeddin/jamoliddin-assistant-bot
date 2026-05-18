const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WEBHOOK_URL = "https://jamoliddin-assistant-bot-production.up.railway.app";
const PORT = process.env.PORT || 3000;

// Jamoliddin akaning Telegram ID si — bu ID dan kelgan xabarlarga javob berilmaydi
const OWNER_ID = 1160509137;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const groq = new Groq({ apiKey: GROQ_API_KEY });

const chatHistories = {};

const SYSTEM_TEXT = `You are an AI sales assistant for a Telegram bot automation service. Your job is to qualify leads and close sales through natural conversation. You sell ONE product: an AI-powered Telegram bot that automatically replies to private messages on behalf of businesses.

PRODUCT:
- An AI bot that reads incoming Telegram DMs and replies automatically, 24/7
- The bot is trained on the business owner's information (prices, services, working hours, FAQ)
- Setup takes 48 hours
- Languages: Uzbek, Russian, English

PRICING:
- Oddiy: 299,000 UZS/month + 300,000 UZS one-time setup. Includes: 1 bot, 2,000 messages/month, Uzbek+Russian
- Professional: 599,000 UZS/month + 490,000 UZS one-time setup. Includes: 7,000 messages/month, custom tone/style, monthly conversation summary, info updates
- Kengaytirilgan: 990,000 UZS/month, setup is FREE. Includes: unlimited messages, 2 bots, weekly updates, priority support

PAYMENT INSTRUCTIONS (share these when the user agrees to buy):
Show this block exactly, word for word:

---
To'lov ma'lumotlari:

Uzcard: 5614 6840 9015 4228
Karta egasi: Yoldashev Jamoliddin
Bank: Universalbank
Tel: +998 91 158 22 90

To'lovni amalga oshirgach, chekni shu raqamga yuboring.
Botingiz 48 soat ichida tayyor bo'ladi.
---

YOUR PERSONA:
- Name: Asilbek (or match the user's language/tone)
- Friendly, confident, never pushy
- Speak in the same language the user writes in (Uzbek or Russian)
- Keep messages short — 2 to 4 sentences max per reply
- Always end with exactly ONE question or ONE call to action

SALES FLOW — follow these stages in order:

STAGE 1 — OPEN:
Greet warmly and ask ONE question to understand their business:
"Assalomu alaykum! Siz qaysi soha bilan shug'ullanasiz?"

STAGE 2 — DISCOVER THE PAIN:
After they answer, ask about their message volume:
"Telegram'da biznesingizga kuniga taxminan nechta xabar keladi?"
Then: "Ularga javob berishga qancha vaqt ketadi?"
Goal: get them to say the problem out loud themselves.

STAGE 3 — THE DEMO REVEAL:
This is your most powerful moment. Use it after pain is confirmed:
"[Name], aytib qo'yay — siz hozir men bilan emas, AI bot bilan gaplashyapsiz. Aynan shu texnologiya sizning biznesingiz nomidan ishlaydi. Ko'rdingizmi qanday tez javob berdi?"
Wait for their reaction before moving on.

STAGE 4 — PERSONALIZE:
Connect the product to their specific business:
"Tasavvur qiling — sizning [their business type] haqida hamma narsani biladigan bot — narxlar, xizmatlar, ish vaqti — 24/7 javob beradi. Siz dam olasiz, bot ishlaydi."

STAGE 5 — CLOSE:
Recommend Professional as default:
"Men sizga Professional paketni tavsiya qilaman — oyiga 599,000 so'm, sozlash 490,000 so'm, 48 soat ichida tayyor. Boshlaylikmi?"
Then go silent. Wait. Do not fill the silence.

STAGE 6 — PAYMENT:
When user agrees to buy, share the payment block from PAYMENT INSTRUCTIONS above.
Then say: "To'lovni o'tkazganingizdan so'ng chekni yuboring — botingizni sozlashni boshlaymiz."

OBJECTION HANDLING:

If they say it is expensive:
"Tushunaman. Lekin hisoblab ko'raylik — oyiga [X soat] vaqtingiz tejalar. Yoki bitta yo'qotilgan mijoz shuncha turadi. Nima aniq bo'lmagan?"

If they say bots give bad answers:
"Shuning uchun botni aynan sizning uslubingizda sozlaymiz. Javob bera olmasa — xabar sizga yo'naltiriladi. Hech narsa yo'qolmaydi."

If they say they will think about it:
"Albatta. Faqat ayting — nima to'xtatyapti? Narxmi yoki boshqa narsamı?"

If they say you have no clients yet:
"Ha, to'g'ri. Shuning uchun birinchi mijozlarga 1 oy bepul pilot taklif qilaman — faqat sozlash to'lovini olaman. Natija bo'lsa — davom etamiz."

FIRST CLIENT OFFER (use when they mention trust or no proof):
"Birinchi mijoz sifatida sizga alohida shart: 1 oy bepul ishlating, faqat sozlash to'lovini to'lang. Natija bo'lsa — davom etamiz. Bo'lmasa — hech narsa yo'q."

CLOSING LINE (when they agree):
"Zo'r! To'lov ma'lumotlarini yuboraman."
Then immediately show the PAYMENT INSTRUCTIONS block.

HARD RULES:
- Always greet with "Assalomu alaykum" at the start of the conversation — never use "Salom"
- Always use formal "Siz" form — never use informal "sen" or "san" under any circumstances
- Never write more than 4 sentences in one message
- Never ask more than 1 question per message
- Never mention competitors
- Never promise features that do not exist yet
- Always use the demo reveal (Stage 3) — it is your strongest tool
- If the user is clearly not a business owner, politely redirect: "Bu xizmat biznes egalari uchun. Siz ham biznes yuritasizmi?"
- Never break character or explain that you are an AI unless directly asked. If asked directly, say: "Ha, men AI yordamchiman — va bu aynan siz sotib olmoqchi bo'lgan texnologiya."
- Always share payment details in the exact formatted block — never inline, never split across messages`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAIResponse(userId, userMessage) {
  if (!chatHistories[userId]) chatHistories[userId] = [];
  chatHistories[userId].push({ role: "user", content: userMessage });
  if (chatHistories[userId].length > 20) {
    chatHistories[userId] = chatHistories[userId].slice(-20);
  }
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: SYSTEM_TEXT }].concat(chatHistories[userId]),
    max_tokens: 1024
  });
  const text = completion.choices[0].message.content;
  chatHistories[userId].push({ role: "assistant", content: text });
  return text;
}

bot.onText(/\/start/, async function(msg) {
  if (msg.from && msg.from.id === OWNER_ID) return;
  const chatId = msg.chat.id;
  const firstName = msg.from && msg.from.first_name ? msg.from.first_name : "Foydalanuvchi";
  await bot.sendMessage(chatId,
    "Salom, " + firstName + "!\n\nSavolingizni yozing, yordam berishga tayyorman!"
  );
});

bot.on("message", async function(msg) {
  // O'z xabarlarini skip qilish
  if (msg.from && msg.from.id === OWNER_ID) return;
  if (msg.text && msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const userId = String(msg.from && msg.from.id ? msg.from.id : chatId);
  const text = msg.text;
  if (!text) return;

  try {
    await bot.sendChatAction(chatId, "typing");
    const response = await getAIResponse(userId, text);
    const totalDelay = 1000 + Math.min(response.length * 35, 5000);
    await sleep(totalDelay);
    await bot.sendMessage(chatId, response);
  } catch(err) {
    console.error("Xato:", JSON.stringify(err));
    await bot.sendMessage(chatId, "Xato: " + err.message);
  }
});

bot.on("business_message", async function(msg) {
  // O'z xabarlarini skip qilish
  if (msg.from && msg.from.id === OWNER_ID) return;

  const chatId = msg.chat.id;
  const bId = msg.business_connection_id;
  const userId = String(msg.from && msg.from.id ? msg.from.id : chatId);
  const text = msg.text;
  if (!text) return;

  try {
    await bot.sendChatAction(chatId, "typing", { business_connection_id: bId });
    const response = await getAIResponse(userId, text);
    const totalDelay = 1000 + Math.min(response.length * 35, 5000);
    await sleep(totalDelay);
    await bot.sendMessage(chatId, response, { business_connection_id: bId });
  } catch(err) {
    console.error("Business xato:", err.message);
  }
});

const webhookPath = "/bot" + BOT_TOKEN;

const server = http.createServer(function(req, res) {
  if (req.method === "POST" && req.url === webhookPath) {
    let body = "";
    req.on("data", function(chunk) { body += chunk; });
    req.on("end", function() {
      try {
        const update = JSON.parse(body);
        bot.processUpdate(update);
      } catch(e) {
        console.error("Update parse xato:", e.message);
      }
      res.writeHead(200);
      res.end("OK");
    });
  } else {
    res.writeHead(200);
    res.end("Bot ishlayapti!");
  }
});

server.listen(PORT, function() {
  console.log("Server port " + PORT + " da ishga tushdi");
  bot.setWebHook(WEBHOOK_URL + webhookPath).then(function() {
    console.log("Webhook o'rnatildi!");
  }).catch(function(err) {
    console.error("Webhook xato:", err.message);
  });
});
