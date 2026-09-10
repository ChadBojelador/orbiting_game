import { startServer } from './app.js';
import { loadEnvironment, readConfig } from './config/environment.js';

try {
  loadEnvironment();
  const application = await startServer(readConfig());
  console.log(JSON.stringify({ event: 'server/listening', port: application.port }));
  let isStopping = false;
  const stop = () => {
    if (isStopping) return;
    isStopping = true;
    void application.stop().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch {
  console.error('Server startup failed. Check environment configuration and port availability.');
  process.exitCode = 1;
}
