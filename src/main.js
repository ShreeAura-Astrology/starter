import { Client, Users } from 'node-appwrite';
import { getStaticFile } from './utils.js';
import { OpenAIApi, Configuration } from 'openai';
// const {
//   generateKeyPairSync,
//   createSign,
//   createVerify,
// } = await import('crypto');
//import { request } from 'request';
// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const users = new Users(client);

  try {
    const response = await users.list();
    // Log messages and errors to the Appwrite Console
    // These logs won't be seen by your end users
    log(`Total users: ${response.total}`);
  } catch(err) {
    error("Could not list users: " + err.message);
  }
if (!req.body.prompt && typeof req.body.prompt !== "string") {
  return res.json({ ok: false, error: "Missing required field `prompt`" }, 400);
}

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);
  try {
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS ?? '512'),
    messages: [{ role: 'user', content: req.body.prompt }],
  });
  const completion = response.data.choices[0].message?.content;
  return res.json({ ok: true, completion }, 200);
} catch (err) {
  return res.json({ ok: false, error: 'Failed to query model.' }, 500);
}
  // The req object contains the request data
  if (req.path === "/ping") {
    // Use res object to respond with text(), json(), or binary()
    // Don't forget to return a response!
    return res.text("Pong");
  }
  if (req.method === 'GET') {
    return res.text(getStaticFile('index.html'), 200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }
  return res.json({
    motto: "Build like a team of hundreds_",
    learn: "https://appwrite.io/docs",
    connect: "https://appwrite.io/discord",
    getInspired: "https://builtwith.appwrite.io",
    jwt :"TestStarter"
  });
};
