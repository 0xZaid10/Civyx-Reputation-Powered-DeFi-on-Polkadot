import { Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

// ── Icons ─────────────────────────────────────────────────────────────────────

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.265 5.638 5.899-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────────

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-green-200 hover:shadow-sm transition-all">
      <div className="text-3xl mb-4">{icon}</div>
      <div className="font-semibold text-gray-900 mb-2">{title}</div>
      <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
    </div>
  );
}

// ── Step ──────────────────────────────────────────────────────────────────────

function Step({ n, title, body, color }: { n: string; title: string; body: string; color: string }) {
  return (
    <div className="flex gap-5">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5 ${color}`}>
        {n}
      </div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">{title}</div>
        <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────

export default function Landing() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="pt-20 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">

          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 text-xs text-green-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live on Polkadot Hub
            </div>
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 text-xs text-teal-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              DeFi Trust Layer
            </div>
          </div>

          <h1
            className="font-extrabold tracking-tight text-gray-900 leading-none mb-6"
            style={{ fontSize: 'clamp(40px, 7vw, 76px)', letterSpacing: '-0.04em' }}
          >
            From reputation{' '}
            <span style={{
              background: 'linear-gradient(90deg, #16a34a, #0d9488)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              to financial power.
            </span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-6">
            Civyx is a decentralized identity and DeFi trust layer on Polkadot.
            Prove uniqueness. Build reputation across any dApp.
            Use that reputation to unlock better access to capital.
          </p>

          <div className="flex items-center justify-center gap-6 mb-10 text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Sybil-resistant identity</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-400" />Cross-dApp reputation</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />CivUSD stablecoin</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/app/register"
              className="px-8 py-3.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
            >
              Create your identity →
            </Link>
            {isConnected ? (
              <Link to="/app"
                className="px-8 py-3.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all">
                Go to Dashboard
              </Link>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal}
                    className="px-8 py-3.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all">
                    Connect wallet
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">The Problem</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            One person. A thousand wallets.
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-12 leading-relaxed">
            Creating a blockchain wallet takes 30 seconds and costs nothing.
            Any system that treats each wallet as a separate identity is trivially broken.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { emoji: '🗳️', title: 'Voting gets gamed', body: 'One actor makes hundreds of wallets, giving themselves hundreds of votes in your DAO. Governance collapses.' },
              { emoji: '🪂', title: 'Airdrops get drained', body: 'Token rewards meant for thousands of participants get collected by one person running a script.' },
              { emoji: '🤖', title: 'Reputation is farmed', body: 'Bots endorse each other. Trust scores become meaningless within days of any system going live.' },
            ].map(({ emoji, title, body }) => (
              <div key={title} className="bg-red-50 border border-red-100 rounded-2xl p-5">
                <div className="text-2xl mb-3">{emoji}</div>
                <div className="font-semibold text-gray-900 mb-1.5 text-sm">{title}</div>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-green-600 font-bold text-sm uppercase tracking-widest mb-2">The Civyx Approach</div>
            <p className="text-gray-700 leading-relaxed max-w-2xl mx-auto">
              Civyx enforces one identity per participant — not by verifying who you are,
              but by making it costly and provable to claim a second one.
              Each identity is unique. Each action is traceable to an identity. No personal data required.
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">How It Works</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            Set up in two minutes
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-16 leading-relaxed">
            No forms. No documents. No email. Everything happens on your device and the blockchain.
          </p>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <Step n="1" color="bg-green-600"
              title="A secret key is generated in your browser"
              body="A random secret is created locally and never sent anywhere — not to us, not to the chain. Only you have it. Back it up like you would a seed phrase." />
            <Step n="2" color="bg-teal-600"
              title="Register your identity on-chain"
              body="A one-way fingerprint of your secret is stored on the blockchain with a small deposit. The fingerprint reveals nothing about the secret — it's your public identity anchor." />
            <Step n="3" color="bg-emerald-600"
              title="Link as many wallets as you want"
              body="Got multiple wallets? Link them all under one identity. You prove each link using your secret without ever revealing it. All linked wallets share one identity and one reputation." />
            <Step n="4" color="bg-cyan-600"
              title="Use your identity across any app"
              body="Any app on Polkadot can instantly verify that your wallet belongs to a unique Civyx identity. Vote, claim, build reputation — as a provably unique participant." />
          </div>
        </div>
      </section>

      {/* ── REPUTATION ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Reputation</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            A reputation that actually means something
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            Because every identity is unique, reputation can't be farmed by spinning up new wallets.
            What you earn, you keep. What others say about you, counts.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: '🌍',
                title: 'Global reputation',
                body: 'Awarded by trusted oracles — protocols, apps, and platforms that recognize your on-chain activity. Scales from 0 to 1000.',
              },
              {
                icon: '🤝',
                title: 'Endorsements',
                body: 'Other verified identities can endorse you. Each endorsement carries weight proportional to the endorser\'s own reputation. Earned, not bought.',
              },
              {
                icon: '🏅',
                title: 'Effective reputation',
                body: 'Your combined score from global reputation plus endorsements. This is what apps see when they check your standing.',
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-green-200 hover:shadow-sm transition-all">
                <div className="text-3xl mb-4">{icon}</div>
                <div className="font-semibold text-gray-900 mb-2">{title}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Example identity</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">0x64d8...94A7</div>
              </div>
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium">Active</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Global Rep', value: '240' },
                { label: 'Endorsements', value: '8' },
                { label: 'Effective Rep', value: '312' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-900 font-mono">{value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full" style={{ width: '31.2%', background: 'linear-gradient(90deg, #16a34a, #0d9488)' }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>312 / 1000</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── TASK REWARDS ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Earn Reputation</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            Every action you take earns points
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            Reputation is earned through real on-chain actions — not given out freely.
            Complete tasks, hit milestones, and watch your score grow automatically.
          </p>

          {/* Point curve */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-10">
            <div className="text-sm font-semibold text-gray-900 mb-4 text-center">How points scale</div>
            <div className="flex flex-col sm:flex-row items-stretch gap-4">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-green-600 mb-1">+5</div>
                <div className="text-xs font-semibold text-gray-700 mb-1">points per action</div>
                <div className="text-xs text-gray-400">Until you reach 50 reputation</div>
              </div>
              <div className="flex items-center justify-center text-gray-300 text-2xl font-light px-2">→</div>
              <div className="flex-1 bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-teal-600 mb-1">+3</div>
                <div className="text-xs font-semibold text-gray-700 mb-1">points per action</div>
                <div className="text-xs text-gray-400">After 50 reputation, onwards</div>
              </div>
              <div className="flex items-center justify-center text-gray-300 text-2xl font-light px-2">→</div>
              <div className="flex-1 bg-gray-100 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-gray-600 mb-1">1000</div>
                <div className="text-xs font-semibold text-gray-700 mb-1">maximum score</div>
                <div className="text-xs text-gray-400">Hard cap across the protocol</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              Early participants earn faster. The curve flattens so no single group dominates.
            </p>
          </div>

          {/* Task cards */}
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            {([
              {
                tag: 'Live',
                tagColor: 'text-green-700 bg-green-50 border-green-200',
                title: 'Register your identity',
                body: 'Create your Civyx identity and instantly earn your first reputation points. One-time reward, automatically claimable after registration.',
                points: '+5 pts',
              },
              {
                tag: 'Live',
                tagColor: 'text-green-700 bg-green-50 border-green-200',
                title: 'Reach stake milestones',
                body: 'Hit 100 PAS, 500 PAS, or 1000 PAS staked and claim a separate reward for each milestone. The more committed you are, the more you earn.',
                points: '+5 pts each',
              },
              {
                tag: 'Protocol supported',
                tagColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
                title: 'Participate in governance',
                body: 'Vote in any registered DAO or protocol and earn reputation points. Organizers deploy their own reward contract using the open Civyx standard. A reference implementation is available now.',
                points: '+3–5 pts',
              },
              {
                tag: 'Protocol supported',
                tagColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
                title: 'Claim verified airdrops',
                body: 'Any project can run a Sybil-resistant, reputation-rewarding airdrop using the Civyx Merkle allowlist standard. Claimants earn reputation points alongside their tokens — verified on-chain.',
                points: '+3–5 pts',
              },
            ] as const).map(({ tag, tagColor, title, body, points }) => (
              <div key={title} className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-green-200 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tagColor}`}>{tag}</span>
                  <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">{points}</span>
                </div>
                <div className="font-semibold text-gray-900 mb-2">{title}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-sm text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-900">Every task is claimable once per identity — forever.</span>
              {' '}Double claiming is blocked at the contract level. No gaming, no resets.
              {' '}Any organizer registered in the protocol can deploy task contracts against this same standard today.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Features</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ letterSpacing: '-0.02em' }}>
            The complete DeFi trust layer
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            <FeatureCard icon="🔒" title="Private by design"
              body="No personal information ever touches the blockchain. Your identity is a fingerprint, not a profile." />
            <FeatureCard icon="👛" title="Multi-wallet support"
              body="Link every wallet you own under one identity. One reputation, many addresses — forever." />
            <FeatureCard icon="📡" title="Cross-dApp reputation"
              body="Earn reputation from any dApp with on-chain verifiable state. No integration required from the external protocol." />
            <FeatureCard icon="💵" title="CivUSD stablecoin"
              body="Mint CivUSD with PAS collateral. Higher reputation = lower collateral required. 110% for top-tier identities." />
            <FeatureCard icon="⭐" title="Portable across chains"
              body="Broadcast your full identity snapshot to any Polkadot parachain via XCM. No bridges, no third parties." />
            <FeatureCard icon="🌐" title="Open protocol"
              body="Any app can verify a Civyx identity or requirement with a single contract call. No API keys, no gatekeepers." />
          </div>
        </div>
      </section>

      {/* ── USE CASES ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Use Cases</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ letterSpacing: '-0.02em' }}>
            What Civyx makes possible
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Reputation-backed borrowing', body: 'Mint CivUSD stablecoin with PAS collateral. Your reputation tier directly reduces your collateral requirement — from 180% down to 110% for the most trusted identities.', tag: 'DeFi', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { title: 'Cross-dApp reputation earning', body: 'Already voted in a DAO? Claimed a DeFi airdrop? Prove it on-chain and earn Civyx reputation points — without that protocol ever integrating Civyx.', tag: 'Universal Reputation', color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { title: 'Fair DAO voting', body: 'One identity, one vote. Wallet farming becomes useless when the protocol enforces uniqueness at the identity level. Gate governance by stake or reputation tier.', tag: 'Governance', color: 'text-purple-600 bg-purple-50 border-purple-200' },
              { title: 'Bot-proof airdrops', body: 'Each identity can only claim once per distribution. Allowlists are based on identity commitments — not wallet addresses. Sybil-resistant by default.', tag: 'Token Distribution', color: 'text-orange-600 bg-orange-50 border-orange-200' },
            ].map(({ title, body, tag, color }) => (
              <div key={title} className="border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-sm transition-all bg-white">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-4 ${color}`}>{tag}</span>
                <div className="font-bold text-gray-900 mb-2">{title}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CROSS-CHAIN ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Cross-Chain</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            Your identity travels with you
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            Civyx is built on Polkadot Hub. Using XCM — Polkadot's native cross-chain messaging —
            your identity snapshot can be broadcast to any parachain in the ecosystem.
            No bridges. No third-party services. Native and trust-minimized.
          </p>

          {/* XCM flow */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 mb-10">
            <div className="text-sm font-semibold text-gray-900 mb-6 text-center">How a cross-chain broadcast works</div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">

              <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Step 1</div>
                <div className="font-semibold text-gray-800 text-sm mb-1">Prepare snapshot</div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Call <span className="font-mono bg-gray-50 px-1 rounded">prepareSnapshot(wallet)</span> on
                  IdentityBroadcaster. Returns your full identity snapshot — stake, reputation tier,
                  wallet count, endorsements — plus pre-encoded XCM message bytes.
                </p>
              </div>

              <div className="text-gray-300 text-xl font-light shrink-0 rotate-90 md:rotate-0">→</div>

              <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Step 2</div>
                <div className="font-semibold text-gray-800 text-sm mb-1">Broadcast via XCM</div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Call <span className="font-mono bg-gray-50 px-1 rounded">xcm.send(destination, xcmMessage)</span> directly
                  from your wallet. Polkadot Hub routes the message to the target parachain using XCM V5.
                  No intermediaries involved.
                </p>
              </div>

              <div className="text-gray-300 text-xl font-light shrink-0 rotate-90 md:rotate-0">→</div>

              <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Step 3</div>
                <div className="font-semibold text-gray-800 text-sm mb-1">Parachain receives</div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  The target parachain receives your snapshot — commitment, tier, stake, reputation.
                  Any protocol there can gate access, unlock features, or verify participation
                  without querying Polkadot Hub directly.
                </p>
              </div>

            </div>
          </div>

          {/* Snapshot contents */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">What the snapshot contains</div>
              <div className="space-y-3">
                {([
                  { field: 'commitment',     desc: 'Your unique identity anchor — the on-chain fingerprint' },
                  { field: 'stake',          desc: 'Native PAS tokens locked against your identity' },
                  { field: 'walletCount',    desc: 'Number of wallets linked to this identity' },
                  { field: 'globalRep',      desc: 'Base reputation score from on-chain activity' },
                  { field: 'effectiveRep',   desc: 'Global reputation plus weighted endorsement bonus' },
                  { field: 'endorsements',   desc: 'Total number of peer endorsements received' },
                  { field: 'reputationTier', desc: 'Tier 0–4 based on effective reputation score' },
                  { field: 'snapshotBlock',  desc: 'Block number when the snapshot was taken' },
                ] as const).map(({ field, desc }) => (
                  <div key={field} className="flex items-start gap-3">
                    <span className="font-mono text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded shrink-0 mt-0.5">{field}</span>
                    <span className="text-xs text-gray-500 leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Reputation tiers</div>
                <div className="space-y-2">
                  {([
                    { tier: 'Tier 4', range: '600 – 1000', color: 'text-green-700 bg-green-50 border-green-200' },
                    { tier: 'Tier 3', range: '300 – 599',  color: 'text-teal-700 bg-teal-50 border-teal-200' },
                    { tier: 'Tier 2', range: '100 – 299',  color: 'text-blue-700 bg-blue-50 border-blue-200' },
                    { tier: 'Tier 1', range: '50 – 99',    color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                    { tier: 'Tier 0', range: '0 – 49',     color: 'text-gray-500 bg-gray-50 border-gray-200' },
                  ] as const).map(({ tier, range, color }) => (
                    <div key={tier} className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${color}`}>{tier}</span>
                      <span className="text-xs text-gray-400 font-mono">{range}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Broadcast cooldown</div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Each identity can broadcast once every <span className="font-semibold text-gray-700">100 blocks</span> (~10 minutes).
                  This prevents snapshot spam while keeping reputation data fresh across parachains.
                </p>
              </div>
            </div>
          </div>

          {/* For builders */}
          <div className="bg-white border border-green-200 rounded-2xl p-6">
            <div className="text-sm font-semibold text-gray-900 mb-4">For parachain builders — how to consume a Civyx snapshot</div>
            <div className="grid md:grid-cols-3 gap-4">
              {([
                {
                  step: '1',
                  title: 'Listen for broadcasts',
                  body: 'Index the IdentityBroadcast event emitted by IdentityBroadcaster on Polkadot Hub. Each event carries the full snapshot struct.',
                },
                {
                  step: '2',
                  title: 'Or query TrustOracle directly',
                  body: 'If your parachain has EVM support, call getTrustProfile(wallet) on TrustOracle for a live read. One call returns everything.',
                },
                {
                  step: '3',
                  title: 'Gate by tier or score',
                  body: 'Use reputationTier, effectiveRep, or stake to control access. No Civyx contracts needed on your parachain — just read the snapshot.',
                },
              ] as const).map(({ step, title, body }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">{title}</div>
                    <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── CIVUSD ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">DeFi</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            CivUSD — Reputation-Aware Stablecoin
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            The first stablecoin where your borrowing terms are determined by who you are on-chain —
            not just what you own. Higher reputation means less collateral required.
            No interest. One-time mint fee only.
          </p>

          {/* Collateral tier table */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8">
            <div className="text-sm font-semibold text-gray-900 mb-5 text-center">Collateral requirements by reputation tier</div>
            <div className="grid grid-cols-5 gap-2">
              {([
                { tier: 'Tier 0', rep: '0–49',    ratio: '180%', color: 'border-gray-200 bg-gray-50',        text: 'text-gray-600',   badge: 'text-gray-500 bg-gray-50 border-gray-200' },
                { tier: 'Tier 1', rep: '50–99',   ratio: '150%', color: 'border-indigo-100 bg-indigo-50/40', text: 'text-indigo-700', badge: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { tier: 'Tier 2', rep: '100–299', ratio: '130%', color: 'border-blue-100 bg-blue-50/40',    text: 'text-blue-700',   badge: 'text-blue-700 bg-blue-50 border-blue-200' },
                { tier: 'Tier 3', rep: '300–599', ratio: '115%', color: 'border-teal-100 bg-teal-50/40',    text: 'text-teal-700',   badge: 'text-teal-700 bg-teal-50 border-teal-200' },
                { tier: 'Tier 4', rep: '600+',    ratio: '110%', color: 'border-green-200 bg-green-50/60',  text: 'text-green-700',  badge: 'text-green-700 bg-green-50 border-green-200' },
              ] as const).map(({ tier, rep, ratio, color, text, badge }) => (
                <div key={tier} className={`border rounded-xl p-3 text-center ${color}`}>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge} block mb-2`}>{tier}</span>
                  <div className="text-xs text-gray-400 mb-1">{rep} rep</div>
                  <div className={`text-xl font-extrabold ${text}`}>{ratio}</div>
                  <div className="text-xs text-gray-400 mt-0.5">collateral</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              Example: mint 100 CivUSD at Tier 4 — deposit just 110 PAS. At Tier 0 — deposit 180 PAS.
            </p>
          </div>

          {/* CivUSD mechanics */}
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {([
              { title: 'Identity required', body: 'Only verified Civyx identity holders can mint CivUSD. Multi-wallet abuse is structurally impossible.', icon: 'shield' },
              { title: 'No interest', body: 'A one-time mint fee (0.5% default). No recurring interest, no rate fluctuation. Ethically designed.', icon: 'percent' },
              { title: 'Fully collateralised', body: 'Every CivUSD is backed by PAS collateral locked on-chain. Burn anytime to recover your full stake.', icon: 'lock' },
            ] as const).map(({ title, body }) => (
              <div key={title} className="bg-white border border-gray-100 rounded-xl p-5 hover:border-green-200 transition-all">
                <div className="font-semibold text-gray-900 mb-2">{title}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-sm text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-900">Reputation becomes economically valuable.</span>
              {' '}Every point you earn on Civyx reduces what you need to lock to access capital.
              Unhealthy positions can be liquidated — keeping the system solvent at all times.
            </p>
          </div>
        </div>
      </section>

      {/* ── EXTERNAL TASKS ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Universal Reputation</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            Earn rep from any dApp — no integration required
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            The ExternalTaskVerifier lets users prove actions on any external protocol
            and earn Civyx reputation points — entirely on-chain, with zero trust in off-chain data.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* How it works */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">How it works</div>
              <div className="space-y-4">
                {([
                  { n: '1', title: 'Perform any action', body: 'Vote in a DAO, claim a DeFi airdrop, hold a token, or complete any protocol task.' },
                  { n: '2', title: 'Call claimExternalTask', body: 'Submit the task ID. The contract performs a staticcall on the external protocol to verify your action on-chain.' },
                  { n: '3', title: 'Earn reputation', body: 'If verified, reputation points are awarded automatically. One reward per identity per task — forever enforced.' },
                ] as const).map(({ n, title, body }) => (
                  <div key={n} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}>{n}</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800 mb-0.5">{title}</div>
                      <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported verification patterns */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">Supported verification patterns</div>
              <div className="space-y-3">
                {([
                  { fn: 'hasVoted(address) → bool',    desc: 'True/false — voted in a DAO proposal' },
                  { fn: 'hasClaimed(address) → bool',  desc: 'True/false — claimed a protocol reward' },
                  { fn: 'balanceOf(address) → uint256', desc: 'Non-zero — holds a token or NFT' },
                  { fn: 'balanceOf(address) ≥ amount', desc: 'Threshold — holds a minimum amount' },
                  { fn: 'isMember(address) → bool',    desc: 'True/false — is a protocol member' },
                ] as const).map(({ fn, desc }) => (
                  <div key={fn} className="flex items-start gap-3">
                    <span className="font-mono text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded shrink-0 mt-0.5 whitespace-nowrap">{fn}</span>
                    <span className="text-xs text-gray-500 leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Any view function that accepts an address and returns bool or uint256 works.
                No external protocol integration needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SYNERGY ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">System Synergy</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            Actions → Reputation → Financial Power
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
            The full loop. Every action you take anywhere in the Polkadot ecosystem
            feeds back into a reputation that unlocks real financial advantage.
          </p>

          <div className="flex flex-col md:flex-row items-center gap-3 mb-10">
            {([
              { step: '01', label: 'Act anywhere', desc: 'Vote, claim, hold tokens, participate in any dApp on Polkadot.', color: 'border-gray-200 bg-white', dot: 'bg-gray-400' },
              { step: '02', label: 'Prove on-chain', desc: 'ExternalTaskVerifier calls the dApp contract directly. No off-chain trust.', color: 'border-indigo-100 bg-indigo-50/30', dot: 'bg-indigo-500' },
              { step: '03', label: 'Earn reputation', desc: 'Points awarded to your Civyx identity automatically. Permanent.', color: 'border-teal-100 bg-teal-50/30', dot: 'bg-teal-500' },
              { step: '04', label: 'Unlock CivUSD', desc: 'Higher reputation → lower collateral ratio → better access to capital.', color: 'border-green-200 bg-green-50/40', dot: 'bg-green-500' },
            ] as const).map(({ step, label, desc, color, dot }, i) => (
              <div key={step} className="flex-1 flex items-center gap-2 w-full">
                <div className={`flex-1 border rounded-xl p-4 ${color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{step}</div>
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1">{label}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
                {i < 3 && <div className="text-gray-300 text-xl font-light shrink-0 hidden md:block">→</div>}
              </div>
            ))}
          </div>

          <div className="bg-white border border-green-200 rounded-2xl p-6 text-center">
            <p className="text-base font-semibold text-gray-900 mb-2">
              Reputation is no longer just a number.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed max-w-lg mx-auto">
              In Civyx, reputation is the key to better borrowing terms, fairer governance,
              Sybil-resistant access, and cross-chain identity — all from one unified on-chain score.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-extrabold text-gray-900 mb-5 leading-tight"
            style={{ fontSize: 'clamp(32px, 5vw, 52px)', letterSpacing: '-0.03em' }}>
            Start building your reputation today.
          </h2>
          <p className="text-gray-500 text-lg mb-10 leading-relaxed">
            Every action earns rep. Every rep point unlocks better terms.
            Your identity, your score, your financial advantage.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link to="/app/register"
              className="inline-block px-10 py-4 rounded-full text-base font-bold text-white transition-all hover:opacity-90 hover:shadow-xl"
              style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}>
              Create identity →
            </Link>
            <Link to="/community"
              className="inline-block px-10 py-4 rounded-full text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all">
              Try community drop
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Live on Polkadot Hub Testnet · 0.01 PAS deposit · Fully refundable
          </p>
        </div>
      </section>

      {/* ── CONTRACTS ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">On-Chain</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ letterSpacing: '-0.02em' }}>
            Deployed contracts
          </h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-12 leading-relaxed">
            Every component of Civyx is a live, verified smart contract on Polkadot Hub testnet.
            Identity, reputation, task rewards, and DeFi — no off-chain servers, no admin backdoors.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {([
              { group: 'Identity & Reputation', contracts: [
                { name: 'IdentityRegistry',    addr: '0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f' },
                { name: 'ReputationRegistry',  addr: '0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c' },
                { name: 'OrganizerRegistry',   addr: '0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9' },
                { name: 'TrustOracle',         addr: '0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467' },
                { name: 'IdentityBroadcaster', addr: '0x9A5710098B845e7841E1D09E1bde0dC1e30374AC' },
              ]},
              { group: 'Task Reward System', contracts: [
                { name: 'TaskRewardDispenser',   addr: '0xF5971713619e7622e82f329a3f46B7280E781c58' },
                { name: 'RegisterIdentityTask',  addr: '0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6' },
                { name: 'StakeMilestoneTask',    addr: '0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b' },
                { name: 'GovernanceVoteTask',    addr: '0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672' },
                { name: 'AirdropClaimTask',      addr: '0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe' },
                { name: 'CommunityDrop',         addr: '0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9' },
                { name: 'ExternalTaskVerifier',  addr: '0x434F288ff599e1f56fe27CF372be2941543b4171' },
              ]},
              { group: 'DeFi Layer', contracts: [
                { name: 'CivUSD',                addr: '0x3d3055C0949d94477e31DD123D65eEbe2aD762db' },
              ]},
            ] as const).map(({ group, contracts }) => (
              <div key={group} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{group}</div>
                <div className="space-y-3">
                  {contracts.map(({ name, addr }) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-700 shrink-0">{name}</span>
                      <a
                        href={`https://blockscout-testnet.polkadot.io/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-gray-400 hover:text-green-600 transition-colors truncate"
                      >
                        {addr.slice(0, 10)}…{addr.slice(-6)}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">
            Chain ID: 420420417 · Polkadot Hub Testnet ·{' '}
            <a href="https://blockscout-testnet.polkadot.io" target="_blank" rel="noopener noreferrer"
              className="hover:text-green-600 transition-colors underline underline-offset-2">
              View on Blockscout
            </a>
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10 px-8">
        <div className="w-full flex flex-col md:flex-row items-center gap-6">

          {/* Brand — far left */}
          <div className="flex flex-col items-center md:items-start shrink-0">
            <span className="font-extrabold" style={{
              fontSize: '26px', letterSpacing: '-0.03em',
              background: 'linear-gradient(90deg, #16a34a, #0d9488)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Civyx
            </span>
            <span className="text-xs text-gray-400 mt-0.5">Identity Protocol · Polkadot Hub</span>
          </div>

          {/* Social links — true center */}
          <div className="flex items-center gap-5 flex-1 justify-center">
            <a href="https://civyx.xyz" target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-700 transition-colors" title="Website">
              <GlobeIcon />
            </a>
            <a href="https://github.com/civyx" target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-700 transition-colors" title="GitHub">
              <GithubIcon />
            </a>
            <a href="https://x.com/civyxprotocol" target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-700 transition-colors" title="X">
              <XIcon />
            </a>
          </div>

          {/* Copyright — far right */}
          <p className="text-xs text-gray-400 text-center md:text-right shrink-0">
            Built on Polkadot Hub · Testnet
            <br />© 2026 Civyx
          </p>
        </div>
      </footer>

    </div>
  );
}
