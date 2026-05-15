const TelegramBot = require("node-telegram-bot-api");
const https = require("https");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WEBHOOK_URL = "https://jamoliddin-assistant-bot-production.up.railway.app";
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN, { webHook: { port: PORT } });
bot.setWebHook(WEBHOOK_URL + "/bot" + BOT_TOKEN);

const chatHistories = {};

const SYSTEM_TEXT = "Siz Jamoliddin akaning shaxsiy yordamchisisiz. Ismingiz Yordamchi va siz sun'iy intellekt asosida ishlaysiz. Har doim o'zingizni Men Jamoliddin akaning yordamchisiman, sun'iy intellekt asosida ishlayman deb tanishtiring (faqat birinchi xabarda). Foydalanuvchilarga do'stona, professional va foydali tarzda javob bering. O'zbek tilida muloqot qiling, agar foydalanuvchi boshqa tilda yozsa, o'sha tilda javob bering. Jamoliddin aka haqida so'rashsa: u professional mutaxassis bo'lib, sizni o'z yordamchisi sifatida ishlatadi.";

function groqRequest(messages) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: "llama3-8b-8192",
      messages: [{ role: "system", content: SYSTEM_TEXT }].concat(messages),
      max_tokens: 1024
    };
    const body = JSON.stringify(payload);
    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY,
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, function(res) {
      let data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices &&
            parsed.choices[0] &&
            parsed.choices[0].message &&
            parsed.choices[0].message.content
              ? parsed.choices[0].message.content
              : "Javob olishda xato yuz berdi.";
          resolve(text);
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function getAIResponse(userId, userMessage) {
  if (!chatHistories[userId]) chatHistories[userId] = [];
  chatHistories[userId].push({ role: "user", content: userMessage });
  if (chatHistories[userId].length > 20) {
    chatHistories[userId] = chatHistories[userId].slice(-20);
  }
  const text = await groqRequest(chatHistories[userId]);
  chatHistories[userId].push({ role: "assistant", content: text });
  return text;
}

bot.onText(/\/start/, async function(msg) {
  const chatId = msg.chat.id;
  const firstName = msg.from && msg.from.first_name ? msg.from.first_name : "Foydalanuvchi";
  await bot.sendMessage(chatId,
    "Salom, " + firstName + "!\n\nMen Jamoliddin akaning shaxsiy yordamchisiman. Sun'iy intellekt asosida ishlayman.\n\nSavolingizni yozing!"
  );
});

bot.on("message", async function(msg) {
  if (msg.text && msg.text.startsWith("/")) return;
  const chatId = msg.chat.id;
  const userId = String(msg.from && msg.from.id ? msg.from.id : chatId);
  const text = msg.text;
  if (!text) return;
  try {
    await bot.sendChatAction(chatId, "typing");
    const response = await getAIResponse(userId, text);
    await bot.sendMessage(chatId, response);
  } catch(err) {
    console.error("Xato:", err.message);
    await bot.sendMessage(chatId, "Kechirasiz, texnik muammo yuz berdi. Qayta urinib koring.");
  }
});

bot.on("business_message", async function(msg) {
  const chatId = msg.chat.id;
  const bId = msg.business_connection_id;
  const userId = String(msg.from && msg.from.id ? msg.from.id : chatId);
  const text = msg.text;
  if (!text) return;
  try {
    await bot.sendChatAction(chatId, "typing", { business_connection_id: bId });
    const response = await getAIResponse(userId, text);
    await bot.sendMessage(chatId, response, { business_connection_id: bId });
  } catch(err) {
    console.error("Business xato:", err.message);
  }
});

console.log("Bot webhook rejimida ishga tushdi, port: " + PORT);
