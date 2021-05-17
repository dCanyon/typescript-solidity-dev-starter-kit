import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { MultiSigWallet__factory, MultiSigWallet } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("MultiSigWallet", () => {
  let signers: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carl: SignerWithAddress;
  let ivan: SignerWithAddress;
  let owners: string[];
  let multiSigWallet: MultiSigWallet;


  beforeEach(async () => {
    signers = await ethers.getSigners();
    deployer = signers[0];
    alice = signers[1];
    bob = signers[2];
    carl = signers[3];
    ivan = signers[4];
    owners = [alice.address, bob.address, carl.address];

    const multiSigWalletFactory = (await ethers.getContractFactory(
      "MultiSigWallet",
      deployer
    )) as MultiSigWallet__factory;
    multiSigWallet = await multiSigWalletFactory.deploy(owners, 2);
    await multiSigWallet.deployed();
    
    for (let i = 0; i < owners.length; i++) {
      const owner = await multiSigWallet.owners(i);
      expect(owner).to.eq(owners[i]);

      const isOwner = await multiSigWallet.isOwner(owner);
      expect(isOwner).to.eq(true);
    }

    const numConfirmationsRequired = await multiSigWallet.numConfirmationsRequired();
    
    expect(numConfirmationsRequired).to.eq(2);

    // submit transaction
    await multiSigWallet
    .connect(alice)
    .submitTransaction(carl.address, parseEther("100"), []);
  });

  describe("submitTransaction()", async () => {
    it("should submit transaction", async () => {
      const submittedTx = await multiSigWallet.transactions(0);
      expect(submittedTx.to).to.eq(carl.address);
      expect(submittedTx.value).to.eq(parseEther("100"));
      expect(submittedTx.data).to.eq("0x");
      expect(submittedTx.executed).to.eq(false);
      expect(submittedTx.numConfirmations).to.eq(0);
    });

    it("should not submit transaction if not owner", async () => {
      await expect(
        multiSigWallet
          .connect(ivan)
          .submitTransaction(carl.address, parseEther("100"), [])
      ).to.be.reverted;
    });
  });

  describe("confirmTransaction()", async () => {
    beforeEach(async () => {
      await multiSigWallet
        .connect(alice)
        .confirmTransaction(0);
    })

    it("should confirm transaction", async () => {
      const tx = await multiSigWallet.transactions(0);
      expect(tx.numConfirmations).to.eq(1);

      const isConfirmed = await multiSigWallet.isConfirmed(0, alice.address);
      expect(isConfirmed).to.eq(true);
    });

    it("should not confirm transaction if not exist", async() => {
      await expect(
        multiSigWallet
          .connect(alice)
          .confirmTransaction(1)
      ).to.be.reverted;
    });

    it("should not confirm transaction if executed", async() => {
      // Need test?
    });

    it("should not confirm transaction if confirmed", async() => {
      await expect(
        multiSigWallet
          .connect(alice)
          .confirmTransaction(0)
      ).to.be.reverted;
    });
  });

  describe("executeTransaction()", async () => {
    beforeEach(async () => {
      await multiSigWallet
        .connect(alice)
        .fallback({ value: parseEther("100")});

      await multiSigWallet
        .connect(alice)
        .confirmTransaction(0);

      await multiSigWallet
        .connect(bob)
        .confirmTransaction(0);
    })

    it("should receive ether", async () => {
      const walletBalance = await ethers.provider.getBalance(multiSigWallet.address);
      expect(walletBalance).to.eq(parseEther("100"));
    })

    it("should execute transaction", async () => {
      await multiSigWallet
        .connect(alice)
        .executeTransaction(0);
      
      const tx = await multiSigWallet.transactions(0);
      expect(tx.executed).to.eq(true);

      const walletBalance = await ethers.provider.getBalance(multiSigWallet.address);
      const carlBalance = await ethers.provider.getBalance(carl.address);
      expect(walletBalance).to.eq(parseEther("0"));
      expect(carlBalance).to.eq(parseEther("10100"));
    })
  })

  describe("revokeTransaction()", async () => {
    beforeEach(async () => {
      await multiSigWallet
        .connect(alice)
        .confirmTransaction(0);
    })

    it("should revoke transaction", async () => {
      await multiSigWallet
        .connect(alice)
        .revokeTransaction(0);

      const tx = await multiSigWallet.transactions(0);
      expect(tx.numConfirmations).to.eq(0)

      const isConfirmed = await multiSigWallet.isConfirmed(0, alice.address);
      expect(isConfirmed).to.eq(false);
    })
  })
});
