import * as anchor from '@project-serum/anchor';
import fs from 'fs';
import path from 'path';
import * as spl from '@solana/spl-token';
import * as serumCmn from '@project-serum/common';
import {
  endForEndIdo,
  idoAmount,
  IDOSALE_Program_ID,
  isProd,
  preSecForStartIdo,
  provider,
  saveSec,
  secTrans,
  watermelonMint,
  usdcMint,
  getTokenAccount,
  createTokenAccount,
  saleTime,
  getConnectionString,
  getIdoName,
  Bumps,
  IdoTimes,
  endForEndIdoEsc,
} from './ido-config';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {sleep} from '@project-serum/common';

async function main() {
  const idoName = getIdoName();

  console.log(`IDO Name: ${idoName}`);

  console.log(`------------------------`);
  console.log(`RPC 連線位置: ${getConnectionString()}`);
  const idoAuthoritySaleTokenAccount = await findTokenAccount(
    provider.wallet.publicKey,
  );

  console.log(`銷售者錢包地址: ${provider.wallet.publicKey.toString()}`);
  console.log(
    `銷售者錢包 Token Account 地址: ${idoAuthoritySaleTokenAccount.toString()}`,
  );
  console.log(`------------------------`);
  console.log(`銷售開始基準時間: ${new Date(saleTime * 1000).toUTCString()}`);
  console.log(
    `銷售開始時間: ${new Date(
      (saleTime + preSecForStartIdo) * 1000,
    ).toUTCString()}`,
  );
  console.log(
    `最後存入時間: ${new Date(
      (saleTime + preSecForStartIdo + saveSec) * 1000,
    ).toUTCString()}`,
  );
  console.log(
    `銷售結束時間: ${new Date(
      (saleTime + preSecForStartIdo + endForEndIdo) * 1000,
    ).toUTCString()}`,
  );
  console.log(`銷售數量: ${idoAmount / Math.pow(10, 6)}`);
  console.log(`------------------------`);
  console.log(`銷售幣種 Mint: ${watermelonMint}`);
  console.log(`收款 USDC Mint: ${usdcMint}`);
  console.log(`------------------------`);
  console.log(`環境配置, 是否為正式環境: ${isProd}`);
  console.log(`交易間隔: ${secTrans}`);
  console.log(`------------------------`);
  console.log(`IDO 前置間隔: ${preSecForStartIdo}`);
  console.log(`IDO 存入期間 ${saveSec}`);
  console.log(`IDO 結束期間 ${endForEndIdo}`);

  console.log(`開始計時 30 秒，請確認資訊正確`);
  await serumCmn.sleep(27000);

  console.log(`3 秒後開始執行`);
  await serumCmn.sleep(1000);
  console.log(`2 秒後開始執行`);
  await serumCmn.sleep(1000);
  console.log(`1 秒後開始執行`);
  await serumCmn.sleep(1000);
  console.log(`開始執行`);

  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const program = getRegistryProgram(provider);

  // All mints default to 6 decimal places.
  const watermelonIdoAmount = new anchor.BN(idoAmount);

  // These are all variables the client will have to create to initialize the
  // IDO pool
  // We use the watermelon mint address as the seed, could use something else though.

  await initIdoPool(
    idoName,
    watermelonMint,
    program,
    usdcMint,
    watermelonIdoAmount,
    idoAuthoritySaleTokenAccount,
  );

  await serumCmn.sleep(secTrans * 100);

  const [idoAccount] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(idoName)],
    program.programId,
  );

  console.log(`Ido Account :" ${idoAccount.toString()}`);

  const poolAccountData = await program.account.idoAccount.fetch(idoAccount);

  const buffer = Buffer.from(poolAccountData.idoName as ArrayBuffer);
  console.log(`Ido Name :" ${buffer.toString()}`);
  console.log(`Bumps: ${JSON.stringify(poolAccountData.bumps)}`);
  console.log(`USDC Mint :" ${poolAccountData.usdcMint.toString()}`);
  console.log(
    `Redeemable Mint: " ${poolAccountData.redeemableMint.toString()}`,
  );
  console.log(
    `Watermelon Mint: " ${poolAccountData.watermelonMint.toString()}`,
  );
  console.log(`Pool Usdc: " ${poolAccountData.poolUsdc.toString()}`);
  console.log(
    `Pool Watermelon: " ${poolAccountData.poolWatermelon.toString()}`,
  );
  console.log(
    `Watermelon Mint: " ${poolAccountData.watermelonMint.toString()}`,
  );
  console.log(`ido Authority: " ${poolAccountData.idoAuthority.toString()}`);

  console.log(`Num Ido Tokens: " ${poolAccountData.numIdoTokens.toNumber()}`);
  console.log(
    `Start Ido Ts: " ${poolAccountData.idoTimes.startIdo.toNumber()}`,
  );
  console.log(
    `End DepositsTs: " ${poolAccountData.idoTimes.endDeposits.toNumber()}`,
  );
  console.log(`End Ido Ts: " ${poolAccountData.idoTimes.endIdo.toNumber()}`);
  console.log(
    `End Escrow Ts: " ${poolAccountData.idoTimes.endEscrow.toNumber()}`,
  );

  console.log(`------------------------`);
  console.log('success!');
}

async function initIdoPool(
  idoName: string,
  watermelonMint: anchor.web3.PublicKey,
  program: anchor.Program,
  usdcMint: anchor.web3.PublicKey,
  watermelonIdoAmount: anchor.BN,
  idoAuthorityWatermelon: anchor.web3.PublicKey,
) {
  console.log(`------------------------`);

  const bumps = new Bumps();

  const [idoAccount, idoAccountBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(idoName)],
      program.programId,
    );
  bumps.idoAccount = idoAccountBump;

  const [redeemableMint, redeemableMintBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(idoName), Buffer.from('redeemable_mint')],
      program.programId,
    );
  bumps.redeemableMint = redeemableMintBump;

  const [poolWatermelon, poolWatermelonBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(idoName), Buffer.from('pool_watermelon')],
      program.programId,
    );
  bumps.poolWatermelon = poolWatermelonBump;

  const [poolUsdc, poolUsdcBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(idoName), Buffer.from('pool_usdc')],
      program.programId,
    );
  bumps.poolUsdc = poolUsdcBump;

  console.log(`Pool Watermelon Token Account: ${poolWatermelon.toString()}`);
  console.log(`Pool USDC Token Account: ${poolUsdc.toString()}`);

  const now = Date.now() / 1000;
  console.log(`現在時間: ${now}`);

  const nowBn = new anchor.BN(now + secTrans);

  // 開始 IDO 時間 = 現在時間 + 緩衝時間
  const startIdoTs = nowBn.add(new anchor.BN(preSecForStartIdo));
  console.log(`Ido 開始時間: ${startIdoTs.toNumber()}`);

  // 結束存入時間 = 開始時間 + 存入期間
  const endDepositsTs = startIdoTs.add(new anchor.BN(saveSec));
  console.log(`Ido 存入結束時間: ${endDepositsTs.toNumber()}`);

  // 結束 IDO 時間 = 開始時間 + (整體活動時間 = 存入期間 * 2)
  const endIdoTs = startIdoTs.add(new anchor.BN(endForEndIdo));
  console.log(`Ido 結束時間: ${endIdoTs.toNumber()}`);

  const endIdoEscTs = startIdoTs.add(new anchor.BN(endForEndIdoEsc));
  console.log(`USDC 延遲取出結束時間 : ${endIdoEscTs.toNumber()}`);

  const idoTimes = new IdoTimes();

  idoTimes.startIdo = startIdoTs;
  idoTimes.endDeposits = endDepositsTs;
  idoTimes.endIdo = endIdoTs;
  idoTimes.endEscrow = endIdoEscTs;

  // Atomically create the new account and initialize it with the program.
  // 注意 WatermelonIdoAmount 銷售數量
  try {
    await program.rpc.initializePool(
      idoName,
      bumps,
      watermelonIdoAmount,
      idoTimes,
      {
        accounts: {
          idoAuthority: provider.wallet.publicKey,
          idoAuthorityWatermelon,
          idoAccount,
          watermelonMint,
          usdcMint,
          redeemableMint,
          poolWatermelon,
          poolUsdc,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      },
    );
  } catch (e) {
    console.error(e);
    throw e;
  }

  await sleep(secTrans * 1000);
  const pool_watermelon_account = await getTokenAccount(
    provider,
    poolWatermelon,
  );
  const idoAuthority_watermelon_account = await getTokenAccount(
    provider,
    idoAuthorityWatermelon,
  );

  console.log(
    `此次 IDO 銷售數量（pool）為: ${pool_watermelon_account.amount.toNumber()}`,
  );
  console.log(
    `銷售者的 Watermelon Token Account（因為提交了 IDO, 所以餘額應該為 0）: ${idoAuthorityWatermelon.toString()}, mint: ${
      idoAuthority_watermelon_account.mint
    } amount: ${idoAuthority_watermelon_account.amount.toNumber()}`,
  );
}

export function getRegistryProgram(provider: anchor.Provider): anchor.Program {
  // Read the generated IDL.
  const idl = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '..', 'target/idl/ido_sale.json'),
      'utf8',
    ),
  );

  const registryProgramId = new anchor.web3.PublicKey(IDOSALE_Program_ID);
  // Generate the program client from IDL.
  const registry = new anchor.Program(idl, registryProgramId, provider);

  return registry;
}

export async function findTokenAccount(
  wallet: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> {
  const associatedPublicKey = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    watermelonMint,
    wallet,
  );

  return associatedPublicKey;
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
