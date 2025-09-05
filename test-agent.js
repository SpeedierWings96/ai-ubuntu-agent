const io = require('socket.io-client');

const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('Connected to agent');
  
  // Send a simple task
  socket.emit('task:execute', {
    instruction: 'Take a screenshot of the desktop and then say "Task complete"',
    context: {},
    constraints: []
  });
});

socket.on('task:created', (data) => {
  console.log('Task created:', data.id);
});

socket.on('task:started', (data) => {
  console.log('Task started');
});

socket.on('task:step', (data) => {
  console.log('Step:', JSON.stringify(data.step, null, 2));
});

socket.on('task:completed', (data) => {
  console.log('Task completed:', data);
  process.exit(0);
});

socket.on('task:failed', (data) => {
  console.log('Task failed:', data.error);
  process.exit(1);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout - task took too long');
  process.exit(1);
}, 60000);