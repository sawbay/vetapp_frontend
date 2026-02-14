import { useWallet } from "@aptos-labs/wallet-adapter-react";
// Internal Components
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Gauge } from "@/components/gauge/Gauge";

function App() {
  const { connected } = useWallet();

  return (
    <>
      <Header />
      <div className="flex items-center justify-center flex-col">
        <Card className="w-full max-w-5xl">
          <CardContent className="flex flex-col gap-10 pt-6">
            {/* <Migrate /> */}
            <Gauge />
            {
              connected ? (
                <>
                  {/* <Vote /> */}
                  {/* <UserLocks /> */}
                </>
              ) : (
                <CardTitle>To get started Connect a wallet</CardTitle>
              )
            }
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default App;
