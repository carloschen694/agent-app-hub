import { AppRouter } from './app-shell/AppRouter';
import { AgentProvider } from './agent/context/AgentProvider';

function App() {
  return (
    <AgentProvider>
      <AppRouter />
    </AgentProvider>
  );
}

export default App;
