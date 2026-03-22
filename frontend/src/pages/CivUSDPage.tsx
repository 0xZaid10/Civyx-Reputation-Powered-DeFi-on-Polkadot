import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { useIdentity } from '@/hooks/useIdentity';
import { CONTRACTS, blockscoutTx, blockscoutAddress } from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';

// ── ABIs ──────────────────────────────────────────────────────────────────────

const CIVUSD_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'civUsdAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'burn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'civUsdAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'maxMintable',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'wallet',    type: 'address' },
      { name: 'collateral', type: 'uint256' },
    ],
    outputs: [
      { name: 'net',   type: 'uint256' },
      { name: 'fee',   type: 'uint256' },
      { name: 'ratio', type: 'uint256' },
    ],
  },
  {
    name: 'getPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'lockedCollateral', type: 'uint256' },
      { name: 'mintedAmount',     type: 'uint256' },
      { name: 'currentRatioBps',  type: 'uint256' },
      { name: 'currentRep',       type: 'uint256' },
    ],
  },
  {
    name: 'collateralRatioFor',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'isHealthy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'canMint',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'pasUsdPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'mintFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalCollateral',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ── Tier config ───────────────────────────────────────────────────────────────

const TIERS = [
  { tier: 'Tier 0', range: '0 – 49',    ratio: 180, color: 'border-gray-200 bg-gray-50',         text: 'text-gray-600',    badge: 'text-gray-500 bg-gray-50 border-gray-200' },
  { tier: 'Tier 1', range: '50 – 99',   ratio: 150, color: 'border-indigo-100 bg-indigo-50/50',  text: 'text-indigo-700',  badge: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { tier: 'Tier 2', range: '100 – 299', ratio: 130, color: 'border-blue-100 bg-blue-50/50',      text: 'text-blue-700',    badge: 'text-blue-700 bg-blue-50 border-blue-200' },
  { tier: 'Tier 3', range: '300 – 599', ratio: 115, color: 'border-teal-100 bg-teal-50/50',      text: 'text-teal-700',    badge: 'text-teal-700 bg-teal-50 border-teal-200' },
  { tier: 'Tier 4', range: '600+',      ratio: 110, color: 'border-green-200 bg-green-50/60',    text: 'text-green-700',   badge: 'text-green-700 bg-green-50 border-green-200' },
] as const;

function getTierIndex(ratio: number): number {
  if (ratio <= 110) return 4;
  if (ratio <= 115) return 3;
  if (ratio <= 130) return 2;
  if (ratio <= 150) return 1;
  return 0;
}

function formatPAS(wei: bigint): string {
  return parseFloat(formatEther(wei)).toFixed(4);
}

function formatCivUSD(raw: bigint): string {
  // CivUSD has 18 decimals same as ETH
  return parseFloat(formatEther(raw)).toFixed(4);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CivUSDPage() {
  const { address, isConnected } = useAccount();
  const identity = useIdentity();
  const { data: walletBalance } = useBalance({ address });

  const [tab,         setTab]         = useState<'mint' | 'burn'>('mint');
  const [collInput,   setCollInput]   = useState('');
  const [burnInput,   setBurnInput]   = useState('');
  const [mintTxHash,  setMintTxHash]  = useState<`0x${string}` | undefined>();

  // Add CivUSD to MetaMask
  const addToMetaMask = async () => {
    try {
      const { ethereum } = window as any;
      if (!ethereum) return;
      await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address:  CONTRACTS.CivUSD,
            symbol:   'CivUSD',
            decimals: 18,
            image:    'https://civyx-reputation-powered-de-fi-on-p.vercel.app/civusd-icon.png',
          },
        },
      });
    } catch (e) {
      console.error('wallet_watchAsset failed', e);
    }
  };
  const [burnTxHash,  setBurnTxHash]  = useState<`0x${string}` | undefined>();
  const [error,       setError]       = useState('');

  // Contract reads
  const { data: position, refetch: refetchPos } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'getPosition',
    args:         [address!],
    query:        { enabled: !!address },
  });

  const { data: ratio } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'collateralRatioFor',
    args:         [address!],
    query:        { enabled: !!address },
  });

  const { data: healthy } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'isHealthy',
    args:         [address!],
    query:        { enabled: !!address },
  });

  const { data: pasPrice } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'pasUsdPrice',
  });

  const { data: feeBps } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'mintFeeBps',
  });

  const { data: totalCol } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'totalCollateral',
  });

  const { data: civUsdBal, refetch: refetchBal } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'balanceOf',
    args:         [address!],
    query:        { enabled: !!address },
  });

  // Quote for mint input
  const collWei = (() => {
    try { return parseEther(collInput || '0'); } catch { return 0n; }
  })();

  const { data: quote } = useReadContract({
    address:      CONTRACTS.CivUSD as `0x${string}`,
    abi:          CIVUSD_ABI,
    functionName: 'maxMintable',
    args:         [address!, collWei],
    query:        { enabled: !!address && collWei > 0n },
  });

  // Write contracts
  const { writeContract: writeMint, data: mintHash, isPending: mintPending, error: mintErr, reset: resetMint } = useWriteContract();
  const { writeContract: writeBurn, data: burnHash, isPending: burnPending, error: burnErr, reset: resetBurn } = useWriteContract();

  const { isSuccess: mintSuccess, isLoading: mintConfirming } = useWaitForTransactionReceipt({ hash: mintHash, timeout: 60_000, pollingInterval: 3_000 });
  const { isSuccess: burnSuccess, isLoading: burnConfirming } = useWaitForTransactionReceipt({ hash: burnHash, timeout: 60_000, pollingInterval: 3_000 });

  useEffect(() => { if (mintHash) setMintTxHash(mintHash); }, [mintHash]);
  useEffect(() => { if (burnHash) setBurnTxHash(burnHash); }, [burnHash]);
  useEffect(() => { if (mintErr) setError(mintErr.message?.slice(0, 140) ?? 'Mint failed'); }, [mintErr]);
  useEffect(() => { if (burnErr) setError(burnErr.message?.slice(0, 140) ?? 'Burn failed'); }, [burnErr]);
  useEffect(() => {
    if (mintSuccess || burnSuccess) {
      refetchPos(); refetchBal(); setCollInput(''); setBurnInput('');
    }
  }, [mintSuccess, burnSuccess]);

  const handleMint = () => {
    if (!quote || collWei === 0n) return;
    setError('');
    const [net] = quote as [bigint, bigint, bigint];
    writeMint({
      address:      CONTRACTS.CivUSD as `0x${string}`,
      abi:          CIVUSD_ABI,
      functionName: 'mint',
      args:         [net],
      value:        collWei,
      gas:          TX_OPTIONS.gas,
      gasPrice:     TX_OPTIONS.gasPrice,
    });
  };

  const handleBurn = () => {
    setError('');
    try {
      const amount = parseEther(burnInput);
      writeBurn({
        address:      CONTRACTS.CivUSD as `0x${string}`,
        abi:          CIVUSD_ABI,
        functionName: 'burn',
        args:         [amount],
        ...TX_OPTIONS,
      });
    } catch { setError('Invalid amount'); }
  };

  const currentRatio     = ratio ? Number(ratio as bigint) : 180;
  const tierIdx          = getTierIndex(currentRatio);
  const tier             = TIERS[tierIdx];
  const pos              = position as [bigint, bigint, bigint, bigint] | undefined;
  const lockedCollateral = pos?.[0] ?? 0n;
  const mintedAmount     = pos?.[1] ?? 0n;
  const hasPosition      = mintedAmount > 0n;
  const quoteArr         = quote as [bigint, bigint, bigint] | undefined;
  const pasPriceNum      = pasPrice ? Number(pasPrice as bigint) / 1e8 : 0.05;

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-widest">DeFi · Stablecoin</p>
            <span className="text-xs text-gray-300">·</span>
            <a href={blockscoutAddress(CONTRACTS.CivUSD)} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-green-600 font-mono transition-colors">
              {CONTRACTS.CivUSD.slice(0,10)}…{CONTRACTS.CivUSD.slice(-6)} ↗
            </a>
            <button
              onClick={addToMetaMask}
              className="text-xs font-medium text-white px-3 py-1.5 rounded-full transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
            >
              + Add to MetaMask
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">CivUSD</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Mint a USD-pegged stablecoin backed by PAS collateral.
            Your Civyx reputation directly determines your collateral ratio —
            the higher your score, the less you need to lock.
          </p>
        </div>

        {/* Protocol stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-gray-900 font-mono">
              {totalCol ? `${parseFloat(formatEther(totalCol as bigint)).toFixed(1)}` : '—'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">PAS locked</div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-gray-900 font-mono">
              ${pasPriceNum.toFixed(4)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">PAS price</div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-gray-900 font-mono">
              {feeBps ? (Number(feeBps as bigint) / 100).toFixed(1) : '0.5'}%
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Mint fee</div>
          </div>
        </div>

        {/* Collateral tier table */}
        <div className="border border-gray-100 rounded-2xl p-5 mb-8">
          <div className="text-sm font-semibold text-gray-900 mb-4">Collateral ratio by reputation tier</div>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {TIERS.map((t, i) => (
              <div key={t.tier} className={`border rounded-xl p-2.5 text-center transition-all ${t.color} ${i === tierIdx && isConnected ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}>
                <div className={`text-xs font-bold mb-1 ${t.text}`}>{t.tier}</div>
                <div className="text-xs text-gray-400 mb-1.5">{t.range}</div>
                <div className={`text-lg font-extrabold ${t.text}`}>{t.ratio}%</div>
              </div>
            ))}
          </div>
          {isConnected && (
            <div className="text-xs text-center text-gray-400">
              Your current tier: <span className={`font-semibold ${tier.text}`}>{tier.tier} ({currentRatio}%)</span>
              {tierIdx < 4 && (
                <span className="ml-2">
                  · <Link to="/community" className="text-green-600 hover:underline">Earn more rep to unlock Tier {tierIdx + 1} →</Link>
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3 text-center">
            Example: to mint 100 CivUSD at Tier 4 — deposit 110 PAS. At Tier 0 — deposit 180 PAS.
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center py-12 border border-gray-200 rounded-2xl">
            <p className="text-sm text-gray-500 mb-4">Connect your wallet to mint CivUSD</p>
            <div className="flex justify-center"><ConnectButton /></div>
          </div>
        ) : !identity.isRegistered ? (
          <div className="text-center py-12 border border-gray-200 rounded-2xl">
            <p className="text-sm text-gray-700 font-medium">No Civyx identity found</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">A registered identity is required to mint CivUSD.</p>
            <Link to="/app/register"
              className="inline-block px-6 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}>
              Register identity →
            </Link>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Your position */}
            {hasPosition && (
              <div className={`border rounded-2xl p-5 ${healthy ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-gray-900">Your position</div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    healthy ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'
                  }`}>
                    {healthy ? 'Healthy' : 'Undercollateralised'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                    <div className="text-base font-bold text-gray-900 font-mono">{formatPAS(lockedCollateral)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">PAS locked</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                    <div className="text-base font-bold text-gray-900 font-mono">{formatCivUSD(mintedAmount)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">CivUSD minted</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                    <div className={`text-base font-bold font-mono ${tier.text}`}>{currentRatio}%</div>
                    <div className="text-xs text-gray-400 mt-0.5">Your ratio</div>
                  </div>
                </div>
                {civUsdBal !== undefined && (
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    CivUSD wallet balance: <span className="font-mono font-semibold text-gray-700">{formatCivUSD(civUsdBal as bigint)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mint / Burn tabs */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex border-b border-gray-100">
                {(['mint', 'burn'] as const).map(t => (
                  <button key={t} onClick={() => { setTab(t); setError(''); resetMint(); resetBurn(); }}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                      tab === t
                        ? 'bg-white text-gray-900 border-b-2 border-green-500'
                        : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                    }`}>
                    {t === 'mint' ? 'Mint CivUSD' : 'Burn & Redeem'}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {tab === 'mint' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                        PAS collateral to deposit
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={collInput}
                          onChange={e => setCollInput(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-green-400"
                        />
                        <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-medium">PAS</span>
                      </div>
                      {walletBalance && (
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-gray-400">
                            Balance: {parseFloat(formatEther(walletBalance.value)).toFixed(4)} PAS
                          </span>
                          <button onClick={() => setCollInput(parseFloat(formatEther(walletBalance.value - parseEther('0.01'))).toFixed(4))}
                            className="text-xs text-green-600 hover:text-green-700 font-medium">
                            Max
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quote display */}
                    {quoteArr && collWei > 0n && (
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Collateral ratio</span>
                          <span className={`font-semibold ${tier.text}`}>{currentRatio}% ({tier.tier})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gross CivUSD</span>
                          <span className="font-mono text-gray-700">{formatCivUSD(quoteArr[0] + quoteArr[1])}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Mint fee (0.5%)</span>
                          <span className="font-mono text-gray-500">−{formatCivUSD(quoteArr[1])}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 pt-2">
                          <span className="font-semibold text-gray-700">You receive</span>
                          <span className="font-bold font-mono text-green-700">{formatCivUSD(quoteArr[0])} CivUSD</span>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 break-all">{error}</div>
                    )}

                    {mintSuccess ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">✓</div>
                          <span className="text-sm font-semibold text-green-800">CivUSD minted successfully</span>
                        </div>
                        {mintTxHash && (
                          <a href={blockscoutTx(mintTxHash)} target="_blank" rel="noopener noreferrer"
                            className="block text-xs text-green-700 underline underline-offset-2">
                            View transaction →
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleMint}
                        disabled={!quoteArr || collWei === 0n || mintPending || mintConfirming}
                        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
                      >
                        {mintPending ? 'Confirm in wallet...' : mintConfirming ? 'Minting...' : 'Mint CivUSD →'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                        CivUSD to burn
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={burnInput}
                          onChange={e => setBurnInput(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-green-400"
                        />
                        <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-medium">CivUSD</span>
                      </div>
                      {civUsdBal !== undefined && (
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-gray-400">
                            Balance: {formatCivUSD(civUsdBal as bigint)} CivUSD
                          </span>
                          <button onClick={() => setBurnInput(formatCivUSD(mintedAmount))}
                            className="text-xs text-green-600 hover:text-green-700 font-medium">
                            Max position
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Burn quote */}
                    {burnInput && parseFloat(burnInput) > 0 && mintedAmount > 0n && (() => {
                      try {
                        const burnAmt = parseEther(burnInput);
                        const colReturn = lockedCollateral * burnAmt / mintedAmount;
                        return (
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">CivUSD burned</span>
                              <span className="font-mono text-gray-700">{burnInput}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                              <span className="font-semibold text-gray-700">PAS returned</span>
                              <span className="font-bold font-mono text-teal-700">{formatPAS(colReturn)} PAS</span>
                            </div>
                          </div>
                        );
                      } catch { return null; }
                    })()}

                    {error && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 break-all">{error}</div>
                    )}

                    {burnSuccess ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">✓</div>
                          <span className="text-sm font-semibold text-green-800">CivUSD burned — PAS returned</span>
                        </div>
                        {burnTxHash && (
                          <a href={blockscoutTx(burnTxHash)} target="_blank" rel="noopener noreferrer"
                            className="block text-xs text-green-700 underline underline-offset-2">
                            View transaction →
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleBurn}
                        disabled={!burnInput || burnPending || burnConfirming || mintedAmount === 0n}
                        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2)' }}
                      >
                        {burnPending ? 'Confirm in wallet...' : burnConfirming ? 'Burning...' : 'Burn & Redeem PAS →'}
                      </button>
                    )}

                    {mintedAmount === 0n && (
                      <p className="text-xs text-gray-400 text-center">No open position to burn.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* How it works */}
            <div className="border border-gray-100 rounded-2xl p-5">
              <div className="text-sm font-semibold text-gray-900 mb-4">How CivUSD works</div>
              <div className="space-y-3 text-xs">
                {[
                  { n: '1', t: 'Deposit PAS collateral', b: 'Send PAS when minting. All of it is locked as collateral. Your reputation tier determines how much CivUSD you receive per PAS deposited.' },
                  { n: '2', t: 'Receive CivUSD', b: 'You receive net CivUSD (after 0.5% mint fee). 1 CivUSD = $1 USD. Use it in any DeFi protocol that accepts it.' },
                  { n: '3', t: 'Burn to redeem', b: 'Burn CivUSD anytime to get your PAS back. No time lock. Full proportional collateral returned. No fee on burn.' },
                  { n: '4', t: 'Position health', b: 'If the PAS price drops significantly, your position may become undercollateralised. Top up collateral or burn CivUSD to stay healthy.' },
                ].map(({ n, t, b }) => (
                  <div key={n} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                      style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}>{n}</div>
                    <div>
                      <div className="font-semibold text-gray-800 mb-0.5">{t}</div>
                      <p className="text-gray-500 leading-relaxed">{b}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
