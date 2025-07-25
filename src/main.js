import { Client, Users } from 'node-appwrite';
import { getStaticFile } from './utils.js';
import OpenAI from 'openai';


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
if (!req.body.prompt && typeof req.body.prompt !== "string") {
  return res.json({ ok: false, error: "Missing required field `prompt`" }, 400);
}

const openai = new OpenAI(
  {
    base_url:"https://api.aimlapi.com/v1",
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
}
);
  // Completion Technique
  try {
   const response = await client.chat.completions.create(
    model: "gpt-4o",
    instructions: 'Summarize the content which you receive from user.If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.',
    messages: [{"role": "user", "content": req.body.prompt}]
)

log('response.choices[0].message.content :' + response.choices[0].message.content)
  // const response = await openai.chat.completions.create({
  //   model: 'gpt-4.1',
  //  // max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS ?? '512'),
  //   messages: [{ role: 'user', content: req.body.prompt }],
  // });
  //log('response.choices[0].message.content :' + response.choices[0].message.content);
  //log('response.data.choices[0].message.content :' + response.data.choices[0].message.content);
//   const reponse = await openai.responses.create({
//   model: 'gpt-4o',
//   instructions: 'Summarize the content which you receive from user.If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.',
//   input: req.body.prompt,
// });
  const completion = response.choices[0].message.content;
    return res.json({ ok: true, completion }, 200);
} catch (err) {
  return res.json({ ok: false, error: 'Failed to query model.' + err }, 500);
}

  return res.json({
    motto: "Build like a team of hundreds_",
    learn: "https://appwrite.io/docs",
    connect: "https://appwrite.io/discord",
    getInspired: "https://builtwith.appwrite.io",
    jwt :"TestStarter"
  });
};
