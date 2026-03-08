import Link from "next/link";
import { History, Zap, ArrowRight, Activity } from "lucide-react";

interface Intent {
  id: string;
  pair: string;
  action: string;
  amount: number;
  status: string;
  created_at: string;
  devices: {
    name: string;
    user_id: string;
  };
}

export function RecentActivity({ intents }: { intents: Intent[] }) {
  return (
    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden p-8">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-secondary flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
            <History className="w-5 h-5" />
          </div>
          Recent Activity
        </h3>
        <Link href="/dashboard/audit" className="text-xs font-bold text-gray-400 hover:text-secondary transition-colors flex items-center gap-1 group">
          View Logs
          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {intents.length === 0 ? (
        <div className="p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
            <Zap className="w-8 h-8" />
          </div>
          <p className="text-gray-500 text-sm">No recent activity found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {intents.map((intent) => (
            <div key={intent.id} className="p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    intent.status === "completed" ? "bg-green-50 text-green-500 border-green-100" : "bg-amber-50 text-amber-500 border-amber-100"
                  }`}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-secondary text-sm flex items-center gap-2">
                      {intent.pair}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{intent.action}</span>
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1">
                        <span>{intent.devices.name}</span>
                        <span>•</span>
                        <span>{new Date(intent.created_at).toLocaleTimeString()}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-secondary">{Number(intent.amount).toLocaleString()} <span className="text-[10px] text-gray-400">HBAR</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
