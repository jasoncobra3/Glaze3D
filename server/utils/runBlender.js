const { spawn } = require('child_process');
const path = require('path');

/**
 * Runs a Python script using the virtual environment Python interpreter.
 * @param {string} scriptPath - Absolute or relative path to the Python script.
 * @param {string[]} args - Arguments to pass to the script.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runBlender(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    // Resolve absolute path to the virtual environment python.exe
    const projectRoot = path.resolve(__dirname, '../../');
    const pythonExe = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    const resolvedScriptPath = path.resolve(projectRoot, scriptPath);

    const child = spawn(pythonExe, [resolvedScriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Python process exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = runBlender;
