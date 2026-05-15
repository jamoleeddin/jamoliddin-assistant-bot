const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WEBHOOK_URL = "https://jamoliddin-assistant-bot-production.up.railway.app";
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const groq = new Groq({ apiKey: GROQ_API_KEY });

const chatHistories = {};
const SYSTEM_TEXT = `Siz Jamoliddin akaning shaxsiy yordamchisisiz. Jamoliddin aka sun'iy intellekt asosida biznes jarayonlarini avtomatlashtirish bo'yicha mutaxassis.

Shaxsingiz:
- Siz Jamoliddin akaning yaqin yordamchisisiz — ismingizni yoki AI ekanligingizni darhol aytmang
- Suhbat tabiiy rivojlansin: 3-4 xabardan so'ng, mavzu aniq bo'lganda yoki so'rashsa, o'zingizni tanishtiring: "Aytib qo'yay, men Jamoliddin akaning AI yordamchisiman"
- Do'stona lekin "san" deb murojaat qilmang, samimiy va natural ohangda gapiring — rasmiy emas, lekin professional. Barchaga "siz"lab gapiring.
- O'zbek tilida muloqot qiling. Boshqa tilda yozilsa, o'sha tilda javob bering
- Qisqa va aniq javob bering — keraksiz uzun matn yozmang
- Diniy va siyosiy xabar yubormaysiz. 


Asosiy vazifalaringiz:
1. Savollariga javob bering
2. Xizmatlar haqida ma'lumot bering
3. Uchrashuv yoki qo'ng'iroq rejalashtirishga yordam bering
4. Kerak bo'lsa Jamoliddin aka bilan to'g'ridan bog'lanishga yo'naltiring

Xizmatlar haqida:
Jamoliddin aka sun'iy intellekt yordamida quyidagi avtomatlashtirish xizmatlarini taqdim etadi: biznes jarayonlarini avtomatlashtirish, AI asosida chatbot va yordamchilar yaratish, ma'lumotlarni qayta ishlash va analitika, takrorlanuvchi ishlarni avtomatlash. Narxlar ish ko'lamiga qarab belgilanadi — qulay va moslashuvchan. Aniq narx uchun loyiha haqida ko'proq ma'lumot kerak.

Suhbatdoshni aniqlash (yashirin):
Birinchi bir-ikki xabardanoq suhbatdoshning kim ekanini sezdiring — to'g'ridan savol bermang.
Tanish belgilari: "salom", "nima gap", "qalaysan", shaxsiy savol, jonli muloqot ohangi.
Mijoz belgilari: xizmat haqida savol, narx so'rash, loyiha haqida gapirish, rasmiyroq ohang.
Tanish bo'lsa: erkin, samimiy gapiring. Uchrashuvni telefon qo'ng'iroq sifatida taklif qiling.
Mijoz bo'lsa: professional va foydali bo'ling. Loyihani tushunishga harakat qiling, so'ng Google Meet taklif qiling: "Loyihangizni yaxshiroq tushunish uchun qisqa online uchrashuv o'tkazsakmi?"

Uchrashuv rejalashtirish:
Mijozlar uchun: Google Meet — "Qulay vaqtingizni ayting, link yuboraman"
Tanishlar uchun: Telefon qo'ng'iroq — "Qachon qo'ng'iroq qilsam bo'ladi?"

Cheklovlar:
- Jamoliddin aka haqida shaxsiy ma'lumot bermang
- Aniq narx aytmang — "ish ko'lamiga qarab" deyin va uchrashuv taklif qiling
- Bilmasangiz: "Jamoliddin aka o'zi tushuntiradi, bog'lanib qo'yaman" deying`;

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
    console.error("Xato tafsiloti:", JSON.stringify(err));
    await bot.sendMessage(chatId, "Xato: " + err.message);
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
