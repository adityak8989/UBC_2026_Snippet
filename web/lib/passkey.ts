"use client";

// Passkey checkout with Circle Modular Wallets on Arc testnet (chain 5042002): no browser wallet needed.
//
// A passkey (WebAuthn, P256) owns a Circle smart account (MSCA). Buying sends the USDC approve and
// buyLicense as ONE user operation, so the buyer confirms once with their passkey. Gas is sponsored by
// Circle Gas Station (testnet usage is sponsored automatically with `paymaster: true`); if sponsorship is
// refused, we retry with the smart account paying gas itself in USDC, and the UI asks the buyer to fund
// it from the faucet. The license holder recorded on chain is the smart account address.
//
// Config (public, browser safe): NEXT_PUBLIC_CIRCLE_CLIENT_KEY and NEXT_PUBLIC_CIRCLE_CLIENT_URL
// (https://modular-sdk.circle.com/v1/rpc/w3s/buidl). The client key only works from the passkey domain
// set in the Circle Console (localhost for this demo), so passkeys don't work on Vercel preview URLs.

import {
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  WebAuthnMode,
} from "@circle-fin/modular-wallets-core";
import { useSyncExternalStore } from "react";
import { createPublicClient, encodeFunctionData, parseEventLogs, type Hex } from "viem";
import { createBundlerClient, toWebAuthnAccount } from "viem/account-abstraction";
import { arcTestnet } from "viem/chains";
import { ERC20Abi, SnippetLicensesAbi } from "./abi";
import { SNIPPET_LICENSES_ADDRESS, USDC_ADDRESS } from "./arc";

const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY ?? "";
const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL ?? "";

export const passkeyConfigured = clientKey !== "" && clientUrl !== "";

// ---------------------------------------------------------------- stored session

// Only public data: the passkey's credential id and public key (never a private key; that stays in the
// device's authenticator), plus the name the buyer chose. Lets a returning buyer skip signing in again.
const STORAGE_KEY = "snippet.passkey.credential";

export interface StoredPasskey {
  id: string;
  publicKey: Hex;
  rpId?: string;
  username: string;
}

export function loadPasskey(): StoredPasskey | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPasskey) : undefined;
  } catch {
    return undefined;
  }
}

// Components that only need to know whether a passkey is signed in (the clip page) subscribe here, so
// they update the moment the passkey checkout signs in or out.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function savePasskey(p: StoredPasskey) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // storage blocked: the buyer signs in again next time
  }
  notify();
}

export function forgetPasskey() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do
  }
  notify();
}

function subscribePasskey(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** True when a passkey account is signed in on this device (false on the server and before hydration). */
export function usePasskeySignedIn(): boolean {
  return useSyncExternalStore(
    subscribePasskey,
    () => passkeyConfigured && loadPasskey() !== undefined,
    () => false,
  );
}

// ---------------------------------------------------------------- sign up / sign in

/** Creates a new passkey (Register) or uses an existing one (Login). Opens the device's passkey prompt. */
export async function passkeySignIn(mode: "register" | "login", username: string): Promise<StoredPasskey> {
  const transport = toPasskeyTransport(clientUrl, clientKey);
  const credential = await toWebAuthnCredential({
    transport,
    mode: mode === "register" ? WebAuthnMode.Register : WebAuthnMode.Login,
    ...(mode === "register" ? { username } : {}),
  });
  const stored: StoredPasskey = {
    id: credential.id,
    publicKey: credential.publicKey,
    rpId: credential.rpId,
    username: mode === "register" ? username : username || "passkey",
  };
  savePasskey(stored);
  return stored;
}

// ---------------------------------------------------------------- smart account

function clients(passkey: StoredPasskey) {
  const transport = toModularTransport(`${clientUrl}/arcTestnet`, clientKey);
  const client = createPublicClient({ chain: arcTestnet, transport });
  const owner = toWebAuthnAccount({
    credential: { id: passkey.id, publicKey: passkey.publicKey },
    rpId: passkey.rpId,
  });
  return { client, transport, owner };
}

export async function getSmartAccount(passkey: StoredPasskey) {
  const { client, transport, owner } = clients(passkey);
  const account = await toCircleSmartAccount({ client, owner });
  const bundler = createBundlerClient({ account, chain: arcTestnet, transport, client });
  return { account, bundler };
}

/** The smart account address for a passkey (counterfactual: valid before its first transaction). */
export async function getSmartAccountAddress(passkey: StoredPasskey) {
  const { account } = await getSmartAccount(passkey);
  return account.address;
}

// ---------------------------------------------------------------- buy

export interface PasskeyPurchase {
  txHash: Hex;
  licenseId: bigint;
  useType: number;
  price: bigint;
  rhAmount: bigint;
  contribAmount: bigint;
  platformAmount: bigint;
  sponsored: boolean; // gas paid by Circle Gas Station
  settledSeconds: number; // passkey confirmation to receipt
}

export class NeedsFundingError extends Error {
  constructor(public address: Hex) {
    super("The passkey account needs testnet USDC for this purchase.");
  }
}

/**
 * approve(USDC → SnippetLicenses, price) + buyLicense(clipId, useType) as one user operation, one passkey
 * confirmation. The approval is for the exact price, never unlimited.
 */
export async function buyWithPasskey(
  passkey: StoredPasskey,
  clipId: Hex,
  useType: number,
  priceUnits: bigint,
  onSigned?: () => void,
): Promise<PasskeyPurchase> {
  const { account, bundler } = await getSmartAccount(passkey);
  const calls = [
    {
      to: USDC_ADDRESS,
      data: encodeFunctionData({ abi: ERC20Abi, functionName: "approve", args: [SNIPPET_LICENSES_ADDRESS, priceUnits] }),
    },
    {
      to: SNIPPET_LICENSES_ADDRESS,
      data: encodeFunctionData({ abi: SnippetLicensesAbi, functionName: "buyLicense", args: [clipId, useType] }),
    },
  ];

  let sponsored = true;
  let hash: Hex;
  try {
    hash = await bundler.sendUserOperation({ account, calls, paymaster: true });
  } catch (err) {
    if (isUserCancel(err)) throw err;
    // Sponsorship refused: try once with the smart account paying gas in USDC.
    console.warn("Passkey checkout: gas sponsorship failed, retrying unsponsored", err);
    sponsored = false;
    try {
      hash = await bundler.sendUserOperation({ account, calls });
    } catch (err2) {
      if (isUserCancel(err2)) throw err2;
      if (looksLikeFunds(err2)) throw new NeedsFundingError(account.address);
      throw err2;
    }
  }
  const sentAt = Date.now();
  onSigned?.();

  const { receipt, success } = await bundler.waitForUserOperationReceipt({ hash, pollingInterval: 250 });
  if (!success) throw new Error("The purchase did not go through on Arc. Nothing was charged except gas.");
  const issued = parseEventLogs({ abi: SnippetLicensesAbi, logs: receipt.logs, eventName: "LicenseIssued" })[0]?.args;
  if (!issued) throw new Error("The purchase confirmed, but no license was found in the transaction.");
  return {
    txHash: receipt.transactionHash,
    licenseId: issued.licenseId,
    useType: issued.useType,
    price: issued.price,
    rhAmount: issued.rhAmount,
    contribAmount: issued.contribAmount,
    platformAmount: issued.platformAmount,
    sponsored,
    settledSeconds: (Date.now() - sentAt) / 1000,
  };
}

function message(err: unknown) {
  return err instanceof Error ? `${err.name} ${err.message}` : String(err);
}
export function isUserCancel(err: unknown) {
  return /NotAllowedError|AbortError|cancel|denied|timed out/i.test(message(err));
}
function looksLikeFunds(err: unknown) {
  return /insufficient|exceeds balance|AA21|didn't pay prefund|transfer amount exceeds/i.test(message(err));
}
