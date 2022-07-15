const { assert, expect } = require("chai");
const { ethers } = require("ethers");
const { artifacts,contract } = require("hardhat");

const MetaMorphies = artifacts.require("MetaMorphies");
const MEMO = artifacts.require("MEMO");
const MorphiePool = artifacts.require("MorphiePool");

contract.only("MorphiePool", (accounts) => {

    beforeEach(async function () {
        baseURI = "http://metamorphies.io/metadata/";
        metaMorphies = await MetaMorphies.new();
        memo = await MEMO.new();
        pool = await MorphiePool.new(metaMorphies.address, memo.address, "5000000000000000000", 300);
        await memo.setPoolContract(pool.address);
        await memo.allowPoolMinting();
        await metaMorphies.setApprovalForAll(pool.address, true);
        await metaMorphies.setApprovalForAll(pool.address, true, {
            from: accounts[1]
        });
        await metaMorphies.setApprovalForAll(pool.address, true, {
            from: accounts[2]
        });
        await metaMorphies.setApprovalForAll(pool.address, true, {
            from: accounts[3]
        });
        await metaMorphies.setApprovalForAll(pool.address, true, {
            from: accounts[4]
        });
    })

    it("Should stake a morphie", async function () {
        //mint a morphie to address
        await metaMorphies.giveAway(accounts[1], 1);

        //stake a morphie
        const tx = await pool.stake(0, {
            from: accounts[1]
        });

        console.log("TX: ", tx.logs[0].args.staker);

        const staker = await pool.stakers(accounts[1]);
        //console.log(staker);
        assert.equal(staker.balance, 1);
    })

    it("Should stake & unstake", async function() {
        //mint a morphie to address
        await metaMorphies.giveAway(accounts[1], 1);

        //stake a morphie
        const tx = await pool.stake(0, {
            from: accounts[1]
        });
        
        await pool.unstake(0, {from: accounts[1]});
    })

    it("Should fail to stake morphie if user is not the owner of the token", async function () {
        //mint a morphie to address
        await metaMorphies.giveAway(accounts[1], 1);

        await expect(
                pool.stake(0, {
                    from: accounts[2]
                }))
            .to.be.revertedWith("Address is not the owner of this Morphie.")
    })

    it("Batch stake some morphies", async function () {
        //mint some morphies to address
        await metaMorphies.giveAway(accounts[1], 30);

        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        let staker = await pool.stakers(accounts[1]);

        assert.equal(staker.balance.toString(), "10");

        await pool.stakeBatch([10, 11, 12, 13, 14, 15, 16, 17, 18, 19], {
            from: accounts[1]
        });

        staker = await pool.stakers(accounts[1]);

        assert.equal(staker.balance.toString(), "20");

        await pool.stakeBatch([20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[1]
        });

        staker = await pool.stakers(accounts[1]);

        assert.equal(staker.balance.toString(), "30");
    })

    it("Should fail to batch stake if user is not the owner", async function () {
        await metaMorphies.giveAway(accounts[1], 20);

        await expect(
                pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
                    from: accounts[2]
                }))
            .to.be.revertedWith("Address is not the owner of this Morphie.")
    })

    it("Should unstake a morphie", async function () {
        //give a morphie to address 1
        await metaMorphies.giveAway(accounts[1], 1);
        //stake morphie
        await pool.stake(0, {
            from: accounts[1]
        });
        //check staker balance
        let staker = await pool.stakers(accounts[1]);
        assert.equal(staker.balance.toString(), "1");
        //unstake morphie
        await pool.unstake(0, {
            from: accounts[1]
        });

        //check that token is gone from pool
        staker = await pool.stakers(accounts[1]);
        assert.equal(staker.balance.toString(), "0");
        //check that token is back to user
        const balance = await metaMorphies.balanceOf(accounts[1]);
        assert.equal(balance.toString(), "1");
    })

    it("Should fail to unstake a morphie if it's not staked by user", async function () {
        //give a morphie to addres 1
        await metaMorphies.giveAway(accounts[1], 1);
        //stake morphie
        await pool.stake(0, {
            from: accounts[1]
        });

        //try to unstake from account 0
        await expect(
                pool.unstake(0))
            .to.be.revertedWith("Token is not staked by this address.");

        //try to unstake from account 2
        await expect(
                pool.unstake(0))
            .to.be.revertedWith("Token is not staked by this address.");
    })

    it("Should batch unstake some morphies", async function () {
        //give away some morphies to address 1
        await metaMorphies.giveAway(accounts[1], 30);
        //enabling minting of MEMO
        await memo.allowPoolMinting();

        //stake them morphies
        await pool.stakeBatch(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
                from: accounts[1]
            }
        )

        let staker = await pool.stakers(accounts[1])

        //check balance
        assert.equal(staker.balance.toString(), "30");

        //batch unstake 10
        await pool.unstakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });
        //check that tokens are gone from pool
        staker = await pool.stakers(accounts[1]);
        assert.equal(staker.balance.toString(), "20");
        //check that they are back in the user's wallet
        let balance = await metaMorphies.balanceOf(accounts[1]);
        assert.equal(balance.toString(), "10");

        //batch unstake 10 more
        await pool.unstakeBatch([10, 11, 12, 13, 14, 15, 16, 17, 18, 19], {
            from: accounts[1]
        });
        //check that tokens are gone from the pool
        staker = await pool.stakers(accounts[1]);
        assert.equal(staker.balance.toString(), "10");
        //check that they are back in the user's wallet
        balance = await metaMorphies.balanceOf(accounts[1]);
        assert.equal(balance.toString(), "20");

        //batch unstake the last 10
        await pool.unstakeBatch([20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[1]
        });
        //check that tokens are gone from the pool
        staker = await pool.stakers(accounts[1]);
        assert.equal(staker.balance.toString(), "0");
        //check that they are back in the user's wallet
        balance = await metaMorphies.balanceOf(accounts[1]);
        assert.equal(balance.toString(), "30");
    })

    it("Should fail to batch unstake if user is not the owner", async function () {
        //give away some morphies
        await metaMorphies.giveAway(accounts[1], 10);
        //stake
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        })

        //try to unstake from account 0
        await expect(
                pool.unstakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
            .to.be.revertedWith("Token is not staked by this address.")

        //try to unstake from account 2
        await expect(
                pool.unstakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
                    from: accounts[2]
                }))
            .to.be.revertedWith("Token is not staked by this address.")
    })

    it("Should emergency unstake a morphie", async function () {
        await metaMorphies.giveAway(accounts[1], 1);

        await pool.stake(0, {
            from: accounts[1]
        });

        let staker = await pool.stakers(accounts[1]);

        assert.equal(staker.balance.toString(), "1");

        await pool.emergencyUnstake(0, {
            from: accounts[1]
        });

        staker = await pool.stakers(accounts[1]);

        assert.equal(staker.balance.toString(), "0");
    })

    it("Should fail to emergency unstake if user is not the owner", async function () {
        await metaMorphies.giveAway(accounts[1], 1);

        await pool.stake(0, {
            from: accounts[1]
        });

        await expect(
                pool.emergencyUnstake(0))
            .to.be.revertedWith("Token is not staked by this address.")

        await expect(
                pool.emergencyUnstake(0, {
                    from: accounts[2]
                }))
            .to.be.revertedWith("Token is not staked by this address.")
    })

    it("Should get earned tokens", async function () {
        //give away 10 tokens to address 1
        await metaMorphies.giveAway(accounts[1], 10);

        await metaMorphies.giveAway(accounts[2], 4);

        await metaMorphies.giveAway(accounts[3], 1);

        await metaMorphies.giveAway(accounts[4], 15);

        //stake them in the pool
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        await pool.stakeBatch([10, 11, 12, 13], {
            from: accounts[2]
        });

        await pool.stake(14, {
            from: accounts[3]
        });

        await pool.stakeBatch([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[4]
        })

        //make time pass quicker...
        let staker = await pool.stakers(accounts[1]);
        let tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //check rewards
        //10 tokens * 12 * 5 = 600 memo tokens
        let rewards = await pool.earned(accounts[1]);
        console.log("Rewards: ", rewards.toString());
        assert.equal(rewards.toString(), "600000000000000000000");

        //make time pass quicker...
        staker = await pool.stakers(accounts[2]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");


        // 4 * 12 * 5 = 240 memo
        rewards = await pool.earned(accounts[2]);
        console.log("Rewards: ", rewards.toString());
        assert.equal(rewards.toString(), "240000000000000000000");

        //make time pass quicker...
        staker = await pool.stakers(accounts[3]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");


        // 12 * 5 = 60 memo
        rewards = await pool.earned(accounts[3]);
        console.log("Rewards: ", rewards.toString());
        assert.equal(rewards.toString(), "60000000000000000000");

        //make time pass quicker...
        staker = await pool.stakers(accounts[4]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        // 15 * 12 * 5 = 900 memo
        rewards = await pool.earned(accounts[4]);
        console.log("Rewards: ", rewards.toString());
        assert.equal(rewards.toString(), "900000000000000000000");
    })

    it("Should get lifetime earned tokens", async function () {
        //give away 10 tokens to address 1
        await metaMorphies.giveAway(accounts[1], 10);

        //enabling minting of MEMO
        await memo.allowPoolMinting();

        //stake them morphies in the pool
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        //make time pass quicker...
        let staker = await pool.stakers(accounts[1]);
        let tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //check rewards
        //10 tokens * 12 * 5 = 600 memo tokens
        let rewards = await pool.earned(accounts[1]);
        assert.equal(rewards.toString(), "600000000000000000000");

        //claim rewards
        await pool.claimRewards({
            from: accounts[1]
        });

        //check balance
        const balance = await memo.balanceOf(accounts[1]);

        //make time pass quicker...
        staker = await pool.stakers(accounts[1]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //check lifetime earnings
        rewards = await pool.earned(accounts[1]);
        const lifetimeEarned = await pool.lifetimeEarned(accounts[1]);
        const expectedLifeTimeEarned = ethers.BigNumber.from(balance.toString()).add(ethers.BigNumber.from(rewards.toString()));

        assert.equal(lifetimeEarned.toString(), expectedLifeTimeEarned.toString());

    })

    it("Should get staked tokens", async function () {
        //give away some tokens to addresses
        await metaMorphies.giveAway(accounts[1], 10);

        await metaMorphies.giveAway(accounts[2], 4);

        await metaMorphies.giveAway(accounts[3], 1);

        await metaMorphies.giveAway(accounts[4], 15);

        //stake them
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        await pool.stakeBatch([10, 11, 12, 13], {
            from: accounts[2]
        });

        await pool.stake(14, {
            from: accounts[3]
        });

        await pool.stakeBatch([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[4]
        });

        //get staked tokens
        const staked1 = await pool.getStakedTokens(accounts[1]);
        assert.deepEqual(staked1.map(el => el.toString()), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

        const staked2 = await pool.getStakedTokens(accounts[2]);
        assert.deepEqual(staked2.map(el => el.toString()), ["10", "11", "12", "13"]);

        const staked3 = await pool.getStakedTokens(accounts[3]);
        assert.deepEqual(staked3.map(el => el.toString()), ["14"]);

        const staked4 = await pool.getStakedTokens(accounts[4]);
        assert.deepEqual(staked4.map(el => el.toString()), ["15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29"])
    })

    it("Should claim rewards", async function () {
        //give away some tokens to addresses
        await metaMorphies.giveAway(accounts[1], 10);

        await metaMorphies.giveAway(accounts[2], 4);

        await metaMorphies.giveAway(accounts[3], 1);

        await metaMorphies.giveAway(accounts[4], 15);

        //enabling minting of MEMO
        await memo.allowPoolMinting();

        //stake them morphies in the pool
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        await pool.stakeBatch([10, 11, 12, 13], {
            from: accounts[2]
        });

        await pool.stake(14, {
            from: accounts[3]
        });

        await pool.stakeBatch([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[4]
        });

        // ----- ACCOUNT 1 -----
        //make time pass quicker...
        let staker = await pool.stakers(accounts[1]);
        let tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //claim rewards
        await pool.claimRewards({
            from: accounts[1]
        });

        let balance = await memo.balanceOf(accounts[1]);
        staker = await pool.stakers(accounts[1]);
        assert.equal(balance.toString(), staker.rewardsPaid.toString());

        // ----- ACCOUNT 2 -----
        //claim rewards
        await pool.claimRewards({
            from: accounts[2]
        });

        balance = await memo.balanceOf(accounts[2]);
        staker = await pool.stakers(accounts[2]);
        assert.equal(balance.toString(), staker.rewardsPaid.toString());

        // ----- ACCOUNT 3 -----
        //claim rewards
        await pool.claimRewards({
            from: accounts[3]
        });

        balance = await memo.balanceOf(accounts[3]);
        staker = await pool.stakers(accounts[3]);
        assert.equal(balance.toString(), staker.rewardsPaid.toString());

        // ----- ACCOUNT 4 -----
        //claim rewards
        await pool.claimRewards({
            from: accounts[4]
        });

        balance = await memo.balanceOf(accounts[4]);
        staker = await pool.stakers(accounts[4]);
        assert.equal(balance.toString(), staker.rewardsPaid.toString());
    })

    it("Should set reward params", async function () {
        //get old params
        const oldAmount = await pool.rewardAmount();
        const oldDuration = await pool.rewardAccrueDuration();
        assert.equal(oldAmount.toString(), "5000000000000000000");
        assert.equal(oldDuration.toString(), "300");

        //set new params
        await pool.setRewardParams("7000000000000000000", "350");

        //check values are correctly set
        const newAmount = await pool.rewardAmount();
        const newDuration = await pool.rewardAccrueDuration();
        assert.equal(newAmount.toString(), "7000000000000000000");
        assert.equal(newDuration.toString(), "350");
    })

    it("Should fail to update reward params if sender is not owner", async function () {
        await expect(
                pool.setRewardParams("1", "1", {
                    from: accounts[1]
                }))
            .to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Should check totalRewardsPaid is correct", async function () {
        //give away some tokens to addresses
        await metaMorphies.giveAway(accounts[1], 10);

        await metaMorphies.giveAway(accounts[2], 4);

        //enabling minting of MEMO
        await memo.allowPoolMinting();

        //stake them morphies
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        await pool.stakeBatch([10, 11, 12, 13], {
            from: accounts[2]
        });

        //make time pass quicker...
        let staker = await pool.stakers(accounts[1]);
        let tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("3600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //claim rewards
        await pool.claimRewards({
            from: accounts[1]
        });
        const totalPaid = await pool.totalRewardsPaid();
        assert.equal(totalPaid.toString(), "600166666666666666650");

        await pool.claimRewards({
            from: accounts[2]
        });
        const totalPaid2 = await pool.totalRewardsPaid();
        assert.equal(totalPaid2.toString(), "840233333333333333310");
    })

    it("Should check totalStakedMorphies is correct", async function () {
        //give away some tokens to addresses
        await metaMorphies.giveAway(accounts[1], 10);

        await metaMorphies.giveAway(accounts[2], 4);

        await metaMorphies.giveAway(accounts[3], 1);

        await metaMorphies.giveAway(accounts[4], 15);

        //enabling minting of MEMO
        await memo.allowPoolMinting();

        //stake them morphies in the pool
        await pool.stakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        let total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "10");

        await pool.stakeBatch([10, 11, 12, 13], {
            from: accounts[2]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "14");

        await pool.stake(14, {
            from: accounts[3]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "15");

        await pool.stakeBatch([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[4]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "30");

        //unstake
        await pool.unstakeBatch([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
            from: accounts[1]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "20");

        await pool.unstakeBatch([10, 11, 12, 13], {
            from: accounts[2]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "16");

        await pool.unstake(14, {
            from: accounts[3]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "15");

        await pool.unstakeBatch([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[4]
        });
        total = await pool.totalStakedMorphies();
        assert.equal(total.toString(), "0");
    })

    it("Should run complex testing: stake multiple from multiple accounts, check that ids are correct, unstake them", async function () {
        //give away tokens
        await metaMorphies.giveAway(accounts[1], 10);

        await metaMorphies.giveAway(accounts[2], 4);

        await metaMorphies.giveAway(accounts[3], 1);

        await metaMorphies.giveAway(accounts[4], 15);

        //enabling minting of MEMO
        await memo.allowPoolMinting();

        //stake from account 1
        await pool.stakeBatch([0, 1, 2, 3, 4], {
            from: accounts[1]
        });

        //check toker owner, total staked
        for (let i = 0; i < 5; i++) {
            const owner = await pool.tokenOwner(i);
            assert.equal(owner.toString(), accounts[1]);
        }
        let totalStaked = await pool.totalStakedMorphies();
        assert.equal(totalStaked.toString(), "5");

        //make time pass quicker...
        let staker = await pool.stakers(accounts[1]);
        let tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("300");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //stake some morphies
        await pool.stakeBatch([5, 6, 7, 8, 9], {
            from: accounts[1]
        });

        //check total morphies staked
        //check outstanding rewards
        totalStaked = await pool.totalStakedMorphies();
        assert.equal(totalStaked.toString(), "10");
        staker = await pool.stakers(accounts[1]);
        assert.equal(staker.rewardsOutstanding.toString(), "50166666666666666650");

        //make time pass quicker...
        staker = await pool.stakers(accounts[1]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("300");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //check earned & outstanding
        let earned = await pool.earned(accounts[1]);
        staker = await pool.stakers(accounts[1]);
        assert.equal(earned.toString(), "100166666666666666650");

        //payout
        await pool.claimRewards({
            from: accounts[1]
        });

        //check balance
        let balance = await memo.balanceOf(accounts[1]);
        staker = await pool.stakers(accounts[1]);
        assert.equal(balance.toString(), staker.rewardsPaid.toString());

        //stake from accounts 2 & 3
        await pool.stakeBatch([10, 11], {
            from: accounts[2]
        });
        //check token owner, total staked
        for (let i = 10; i < 12; i++) {
            const owner = await pool.tokenOwner(i);
            assert.equal(owner.toString(), accounts[2])
        }
        totalStaked = await pool.totalStakedMorphies();
        assert.equal(totalStaked.toString(), "12");

        await pool.stake(14, {
            from: accounts[3]
        });
        totalStaked = await pool.totalStakedMorphies();
        assert.equal(totalStaked.toString(), "13");

        //make time pass quicker...
        staker = await pool.stakers(accounts[3]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("300");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //unstake some morphies
        await pool.unstake(11, {
            from: accounts[2]
        });

        //stake rest of morphies from account 2
        await pool.stakeBatch([12, 13], {
            from: accounts[2]
        });

        //check rewards for account 2
        staker = await pool.stakers(accounts[2]);
        assert.equal(staker.rewardsOutstanding.toString(), "49999999999999995");
        assert.equal(staker.rewardsPaid.toString(), "5033333333333333330");
        //check total morphies staked
        totalStaked = await pool.totalStakedMorphies();
        assert.equal(totalStaked.toString(), "14");

        //check rewards for all 3 accounts
        let earned1 = await pool.earned(accounts[1]);
        let earned2 = await pool.earned(accounts[2]);
        let earned3 = await pool.earned(accounts[3]);
        assert.equal(earned1.toString(), "50666666666666666650");
        assert.equal(earned2.toString(), "49999999999999995");
        assert.equal(earned3.toString(), "5033333333333333330");

        //make time pass quicker...
        staker = await pool.stakers(accounts[2]);
        tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("600");
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
        await hre.ethers.provider.send("evm_mine");

        //check earned & outstanding
        earned1 = await pool.earned(accounts[1]);
        earned2 = await pool.earned(accounts[2]);
        earned3 = await pool.earned(accounts[3]);
        assert.equal(earned1.toString(), "150666666666666666650");
        assert.equal(earned2.toString(), "30049999999999999995");
        assert.equal(earned3.toString(), "15033333333333333330");
        let staker1 = await pool.stakers(accounts[1]);
        let staker2 = await pool.stakers(accounts[2]);
        let staker3 = await pool.stakers(accounts[3]);
        assert.equal(staker1.rewardsOutstanding.toString(), "0");
        assert.equal(staker2.rewardsOutstanding.toString(), "49999999999999995");
        assert.equal(staker3.rewardsOutstanding.toString(), "0");

        //payout
        await pool.claimRewards({
            from: accounts[1]
        });
        await pool.claimRewards({
            from: accounts[2]
        });
        await pool.claimRewards({
            from: accounts[3]
        });

        let totalPaid = ethers.BigNumber.from("0");
        //check each balance, rewards paid, lifetime paid, total paid
        for (let i = 1; i < 4; i++) {
            const staker = await pool.stakers(accounts[i]);
            assert.equal(staker.rewardsOutstanding.toString(), "0");
            const balance = await memo.balanceOf(accounts[i]);
            assert.equal(staker.rewardsPaid.toString(), balance.toString());

            totalPaid = totalPaid.add(ethers.BigNumber.from(balance.toString()));
        }

        let lifetimePaid = await pool.totalRewardsPaid();
        assert.equal(totalPaid.toString(), lifetimePaid.toString());

        //stake from account 4
        await pool.stakeBatch([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], {
            from: accounts[4]
        });
        //check balance
        staker = await pool.stakers(accounts[4]);
        assert.equal(staker.balance.toString(), "15");

        for (let i = 15; i < 25; i++) {
            //make time pass quicker...
            tStamp = ethers.BigNumber.from(staker.lastUpdateTime.toString()).add("300");
            await hre.ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(tStamp.toString())]);
            await hre.ethers.provider.send("evm_mine");

            //unstake no. i
            await pool.unstake(i, {from: accounts[4]});
            //check rewards
            staker = await pool.stakers(accounts[4]);
            let balance = await memo.balanceOf(accounts[4]);
            assert.equal(balance.toString(), staker.rewardsPaid.toString());
        }

        //unstake everything from all accounts
        await pool.unstakeBatch([0,1,2,3,4,5,6,7,8,9], {from: accounts[1]});
        await pool.unstakeBatch([10,12,13], {from: accounts[2]});
        await pool.unstake(14, {from: accounts[3]});
        await pool.unstakeBatch([ 25, 26, 27, 28, 29], {from: accounts[4]});

        //check all balances        
        for (let i = 1; i < 5; i++) {
            let staker = await pool.stakers(accounts[i]);
            let balance = await memo.balanceOf(accounts[i]);
            assert.equal(staker.balance.toString(), "0");
            assert.equal(staker.rewardsOutstanding.toString(), "0");
            assert.equal(staker.rewardsPaid.toString(), balance.toString());
        }
    })
})