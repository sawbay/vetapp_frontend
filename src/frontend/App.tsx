import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Route, Routes } from "react-router-dom";
// Internal Components
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { PoolsPage } from "@/components/PoolsPage";
import { Gauge } from "@/components/gauge/Gauge";
import { UserLocks } from "./components/UserLocks";
import { Vote } from "./components/Vote";

function HomePage() {
  const { connected } = useWallet();

  return (
    <>
      {connected ? (
        <>
          <Vote />
          <UserLocks />
        </>
      ) : (
        <CardTitle>To get started Connect a wallet</CardTitle>
      )}
      <Gauge />
    </>
  );
}

function App() {
  return (
    <>
      <Header />
      <div className="flex items-center justify-center flex-col">
        <Card className="w-full max-w-5xl">
          <CardContent className="flex flex-col gap-10 pt-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/pools" element={<PoolsPage />} />
            </Routes>
            {/* <Migrate /> */}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default App;
