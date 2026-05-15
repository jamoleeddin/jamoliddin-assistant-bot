const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Har bir foydalanuvchi uchun suhbat tarixi
const chatHistories = {};

const SYSTEM_PROMPT = `Siz Jamoliddin akaning shaxsiy yordamchisisiz. 
Ismingiz "Yordamchi" va siz sun'iy intellekt asosida ishlaysiz.
Har doim o'zingizni "Men Jamoliddin akaning yordamchisiman, sun'iy intellekt asosida ishlayman" deb tanishtiring (faqat birinchi xabarda).
Foydalanuvchilarga do'stona, professional va foydali tarzda javob bering.
O'zbek tilida muloqot qiling, agar foydalanuvchi boshqa tilda yozsa, o'sha tilda javob bering.
Jamoliddin aka haqida so'rashsa: u professional mutaxassis bo'lib, sizni o'z yordamchisi sifatida ishlatadi.`;

async function getAIResponse(userId, userMessage) {
  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
  }

  chatHistories[userId].push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  // Oxirgi 20 ta xabarni saqlash (memory tejash uchun)
  if (chatHistories[userId].length > 20) {
    chatHistories[userId] = chatHistories[userId].slice(-20);
  }

  const chat = model.startChat({
    history: chatHistories[userId].slice(0, -1),
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await chat.sendMessage(userMessage);
  const responseText = result.response.text();

  chatHistories[userId].push({
    role: "model",
    parts: [{ text: responseText }],
  });

  return responseText;
}

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || "Foydalanuvchi";

  const welcomeMsg = `Salom, ${firstName}! 👋\n\nMen Jamoliddin akaning shaxsiy yordamchisiman. Sun'iy intellekt asosida ishlayman.\n\nSavolingizni yozing, yordam berishga tayyorman! 🤖`;
  await bot.sendMessage(chatId, welcomeMsg);
});

// Oddiy xabarlar
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;

  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString();
  const text = msg.text;

  if (!text) return;

  try {
    await bot.sendChatAction(chatId, "typing");
    const response = await getAIResponse(userId, text);
    await bot.sendMessage(chatId, response);
  } catch (err) {
    console.error("Xato:", err.message);
    await bot.sendMessage(
      chatId,
      "Kechirasiz, hozir texnik muammo bor. Biroz kutib qayta urinib ko'ring."
    );
  }
});

// Business message handleri
bot.on("business_message", async (msg) => {
  const chatId = msg.chat.id;
  const businessConnectionId = msg.business_connection_id;
  const userId = msg.from?.id?.toString();
  const text = msg.text;

  if (!text) return;

  try {
    await bot.sendChatAction(chatId, "typing", {
      business_connection_id: businessConnectionId,
    });

    const response = await getAIResponse(userId, text);

    await bot.sendMessage(chatId, response, {
      business_connection_id: businessConnectionId,
    });
  } catch (err) {
    console.error("Business xato:", err.message);
  }
});

console.log("✅ Bot ishga tushdi...");
