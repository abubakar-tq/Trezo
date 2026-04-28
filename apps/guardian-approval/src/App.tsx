import React, { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, custom, http, type Address, type Hex } from 'viem';
import { mainnet, anvil } from 'viem/chains';
import { Shield, CheckCircle, AlertCircle, Wallet, ArrowRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

// SocialRecovery ABI snippet
const SOCIAL_RECOVERY_ABI = [
  {
    "inputs": [{ "internalType": "bytes32", "name": "hash", "type": "bytes32" }],
    "name": "approveHash",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "hash", "type": "bytes32" }],
    "name": "approvedHashes",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "hash", "type": "bytes32" },
      { "internalType": "address", "name": "guardian", "type": "address" }
    ],
    "name": "isApproved",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const GuardianApproval: React.FC = () => {
  const [address, setAddress] = useState<Address | null>(null);
  const [recoveryHash, setRecoveryHash] = useState<Hex>('0x');
  const [moduleAddress, setModuleAddress] = useState<Address>('0x');
  const [isChecking, setIsChecking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  // Parse URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = params.get('hash') as Hex;
    const module = params.get('module') as Address;
    if (hash) setRecoveryHash(hash);
    if (module) setModuleAddress(module);
  }, []);

  // Check if already approved on-chain
  useEffect(() => {
    if (address && recoveryHash !== '0x' && moduleAddress !== '0x') {
      checkApprovalStatus();
    }
  }, [address, recoveryHash, moduleAddress]);

  const checkApprovalStatus = async () => {
    setIsChecking(true);
    try {
      const publicClient = createPublicClient({
        chain: anvil,
        transport: http()
      });
      
      const approved = await publicClient.readContract({
        address: moduleAddress,
        abi: SOCIAL_RECOVERY_ABI,
        functionName: 'isApproved',
        args: [recoveryHash, address!],
      });

      setIsApproved(approved);
    } catch (error) {
      console.error('Failed to check approval status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('Please install a wallet like MetaMask');
      return;
    }

    try {
      const walletClient = createWalletClient({
        chain: anvil,
        transport: custom(window.ethereum!)
      });
      const [account] = await walletClient.requestAddresses();
      setAddress(account);
      toast.success('Wallet connected!');
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast.error('Failed to connect wallet');
    }
  };

  const handleApprove = async () => {
    if (!address || !recoveryHash || !moduleAddress) {
      toast.error('Missing required information');
      return;
    }

    setIsApproving(true);
    try {
      const walletClient = createWalletClient({
        account: address,
        chain: anvil,
        transport: custom(window.ethereum!)
      });

      const { request } = await createPublicClient({
        chain: anvil,
        transport: http()
      }).simulateContract({
        account: address,
        address: moduleAddress,
        abi: SOCIAL_RECOVERY_ABI,
        functionName: 'approveHash',
        args: [recoveryHash],
      });

      const hash = await walletClient.writeContract(request);

      toast.promise(
        Promise.resolve(hash), 
        {
          loading: 'Sending approval...',
          success: 'Approval submitted successfully!',
          error: 'Failed to submit approval',
        }
      );
      
      setIsApproved(true);
    } catch (error) {
      console.error('Approval failed:', error);
      toast.error('Approval failed. See console for details.');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white p-6 flex flex-col items-center justify-center">
      <Toaster position="top-center" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg glass rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Guardian Approval</h1>
            <p className="text-secondary text-sm">Secure Recovery Authorization</p>
          </div>
        </div>

        {!address ? (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-surface border border-white/5">
              <p className="text-sm text-secondary mb-4">
                You have been requested to approve a wallet recovery. Please connect your guardian wallet to proceed.
              </p>
              <button 
                onClick={connectWallet}
                className="w-full py-4 rounded-xl bg-primary hover:bg-primary-hover transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-surface border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Your Address</span>
                <span className="font-mono text-primary">{address.slice(0, 6)}...{address.slice(-4)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Recovery Hash</span>
                <span className="font-mono">{recoveryHash.slice(0, 6)}...{recoveryHash.slice(-4)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Module</span>
                <span className="font-mono">{moduleAddress.slice(0, 6)}...{moduleAddress.slice(-4)}</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isApproved ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center"
                >
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-green-500">Authorized</h3>
                  <p className="text-sm text-secondary">Your approval has been registered on-chain.</p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-500/80">
                      By approving, you authorize the owner to rotate their wallet access to a new passkey. Only do this if you have verified the identity of the requester.
                    </p>
                  </div>

                  <button 
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="w-full py-4 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 transition-all font-semibold flex items-center justify-center gap-2 group"
                  >
                    {isApproving ? 'Approving...' : 'Approve Recovery'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
          <p className="text-xs text-secondary flex items-center gap-1">
            Powered by Trezo Protocol <ExternalLink className="w-3 h-3" />
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default GuardianApproval;
