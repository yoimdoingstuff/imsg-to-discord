const test = require('node:test');
const assert = require('node:assert/strict');
const LinuxTransport = require('../src/transports/linux');

test('LinuxTransport speaks the documented NDJSON protocol', async () => {
  const originalCommand = process.env.LINUX_IMESSAGE_COMMAND;
  const originalArgs = process.env.LINUX_IMESSAGE_ARGS;

  const backendCode = [
    "console.log(JSON.stringify({event:'ready'}));",
    "setTimeout(() => console.log(JSON.stringify({event:'message',message:{id:1,chatId:'chat-1',sender:'+61400000000',text:'hello',isGroup:false}})), 25);",
    "require('readline').createInterface({input:process.stdin}).on('line', line => {",
    "  try {",
    "    const request = JSON.parse(line);",
    "    if (request.action === 'send') process.stderr.write('send:' + request.chatId + '\\n');",
    "  } catch {}",
    "});",
  ].join('');

  process.env.LINUX_IMESSAGE_COMMAND = process.execPath;
  process.env.LINUX_IMESSAGE_ARGS = JSON.stringify(['-e', backendCode]);

  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('message event timeout')), 3000);

    const transport = new LinuxTransport();

    transport.start(message => {
      clearTimeout(timeout);
      resolve({ transport, message });
    }).catch(reject);
  });

  try {
    const { transport, message } = await received;

    assert.deepEqual(message, {
      id: '1',
      chatId: 'chat-1',
      sender: '+61400000000',
      chatName: null,
      isGroup: false,
      text: 'hello',
      attachments: [],
    });

    await transport.sendText('chat-1', 'reply');
    assert.equal(transport.status().connected, true);

    await transport.close();
  } finally {
    if (originalCommand === undefined) delete process.env.LINUX_IMESSAGE_COMMAND;
    else process.env.LINUX_IMESSAGE_COMMAND = originalCommand;

    if (originalArgs === undefined) delete process.env.LINUX_IMESSAGE_ARGS;
    else process.env.LINUX_IMESSAGE_ARGS = originalArgs;
  }
});
