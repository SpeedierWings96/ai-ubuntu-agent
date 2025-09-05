#!/usr/bin/env node

// Simple command execution server for the desktop container
// This runs on the host and executes commands in the desktop container

const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

const CONTAINER_NAME = process.env.DESKTOP_CONTAINER || 'ai-desktop';
const PORT = process.env.COMMAND_PORT || 8090;
const DISPLAY = process.env.DESKTOP_DISPLAY || ':1';

app.post('/execute', (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }
  
  // Execute command in desktop container
  const dockerCommand = `docker exec ${CONTAINER_NAME} bash -c "DISPLAY=${DISPLAY} ${command.replace(/"/g, '\\"')}"`;
  
  exec(dockerCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.json({
        success: false,
        error: error.message,
        stderr: stderr,
      });
    }
    
    res.json({
      success: true,
      stdout: stdout,
      stderr: stderr,
    });
  });
});

app.post('/screenshot', (req, res) => {
  const commands = [
    `DISPLAY=${DISPLAY} import -window root /tmp/screenshot.png`,
    'cat /tmp/screenshot.png | base64',
    'rm /tmp/screenshot.png'
  ];
  
  const dockerCommand = `docker exec ${CONTAINER_NAME} bash -c "${commands.join(' && ')}"`;
  
  exec(dockerCommand, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.json({
        success: false,
        error: error.message,
      });
    }
    
    res.json({
      success: true,
      image: stdout.trim(),
    });
  });
});

app.listen(PORT, () => {
  console.log(`Desktop command server listening on port ${PORT}`);
  console.log(`Will execute commands in container: ${CONTAINER_NAME}`);
});