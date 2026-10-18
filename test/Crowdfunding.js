//run test using: 
// npx hardhat test
// in cd ~/projects/DARE-project

const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther } = require("ethers");

describe("Crowdfunding contract", function () {
  
  //Fixture
  async function deployContractFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const numberOfDays = 30;
    const goal = parseEther("100"); // 100 ether goal
    const contract = await ethers.deployContract("Crowdfunding", [numberOfDays, goal]);
    const amount = parseEther("1"); // 1 ether contribution

    return { contract, owner, addr1, addr2, amount, goal };
  }

  describe("constructor", function () {
    //contract construction
    it("should have a future deadline upon construction", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      const deadline = await contract.deadline();
      const currentTime = await time.latest();
      expect(deadline).to.be.gt(currentTime);
    });

    it("should have a positive goal upon construction", async function () {
      const { contract } = await loadFixture(deployContractFixture);
      
      const goal = await contract.goal();
      expect(goal).to.be.gt(0);
    });
  });


  //contract contribution
  describe("contribute", function () {
    it("should allow a contribution and update balances", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);

      const transaction = await contract.connect(addr1).contribute({ value: amount });
      
      await expect(transaction).to.changeEtherBalances([addr1, contract], [-amount, amount]); //check balances
      await expect(transaction).to.emit(contract, "Contributed").withArgs(addr1.address, amount); //emit event
    });


    it("should update contract state upon contribution", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: amount });
      
      expect(await contract.contributionsOf(addr1.address)).to.equal(amount); //check contribution
      expect(await contract.totalMoneyRaised()).to.equal(amount); //check total contributions
    });


    it ("should allow multiple contributions from a single address", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: amount });
      await contract.connect(addr1).contribute({ value: amount });

      expect(await contract.contributionsOf(addr1.address)).to.equal(2n * amount);
      expect(await contract.totalMoneyRaised()).to.equal(2n * amount);
    });


    it ("should allow multiple contributions from multiple addresses", async function () {
      const { contract, addr1, addr2, amount } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: amount });
      await contract.connect(addr2).contribute({ value: amount });

      expect(await contract.contributionsOf(addr1.address)).to.equal(amount);
      expect(await contract.contributionsOf(addr2.address)).to.equal(amount);
      expect(await contract.totalMoneyRaised()).to.equal(2n * amount);

    });

    it("should not allow contributions without value", async function () {
      const { contract, addr1 } = await loadFixture(deployContractFixture);

      await expect(contract.connect(addr1).contribute({ value: 0 })).to.be.revertedWith("Contribution amount must be greater than zero.");
    });

    it("should not allow contributions after the deadline", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);

      await time.increaseTo(await contract.deadline() + 1n); //moment after deadline
      await expect(contract.connect(addr1).contribute({ value: amount })).to.be.revertedWith("The crowdfunding campaign has ended.");
    });

    it("should not allow contributions if the campaign is canceled", async function () {
      const { contract, owner, amount } = await loadFixture(deployContractFixture);

      await contract.connect(owner).cancelCampaign(); //cancel the campaign
      await expect(contract.connect(owner).contribute({ value: amount })).to.be.revertedWith("The crowdfunding campaign has been canceled.");
    });

    it("should not allow contributions that exceed the upper limit", async function () {
      const { contract, addr1, goal } = await loadFixture(deployContractFixture);

      const upperLimit = await contract.upperLimit();
      const amount = upperLimit + 1n; //amount exceeding the upper limit
      await expect(contract.connect(addr1).contribute({ value: amount })).to.be.revertedWith("Contribution amount exceeds the upper limit.");
    });

    it("should not allow contributions that overshoot the remaining capacity", async function () {
      const { contract, addr1, addr2 } = await loadFixture(deployContractFixture);

      const upperLimit = await contract.upperLimit();
      await contract.connect(addr1).contribute({ value: upperLimit - 1n }); //should succeed
      await expect(contract.connect(addr2).contribute({ value: 2n })).to.be.revertedWith("Contribution amount exceeds the upper limit.");
    });

    it("should allow contributions that equal the upper limit", async function () {
      const { contract, addr1, goal } = await loadFixture(deployContractFixture);

      const upperLimit = await contract.upperLimit();
      await contract.connect(addr1).contribute({ value: 1n }); //first contribution, should succeed
      await contract.connect(addr1).contribute({ value: upperLimit - 1n }); //second contribution, should succeed and reach the upper limit
      expect(await contract.totalMoneyRaised()).to.equal(upperLimit);
    });
  });

  //contract withdrawal
  describe("claimFunds", function () {
    it("should allow the owner to withdraw funds after the deadline when goal is reached", async function () {
      const { contract, owner, addr1, goal } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: goal }); //contribute enough to reach the goal
      await time.increaseTo(await contract.deadline() + 1n); //moment after deadline
      const transaction = await contract.connect(owner).claimFunds();
      
      await expect(transaction).to.changeEtherBalances([owner, contract], [goal, -goal]);
      await expect(transaction).to.emit(contract, "Withdrawn").withArgs(owner.address, goal); //emit event
    });

    it("should not allow non-owners to withdraw funds", async function () {
      const { contract, addr1, goal } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: goal });
      await time.increaseTo(await contract.deadline() + 1n);
      await expect(contract.connect(addr1).claimFunds()).to.be.revertedWith("Only the organizer can withdraw funds.");
    });

    it("should not allow the owner to withdraw funds before the deadline", async function () {
      const { contract, owner, addr1, goal } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: goal });
      await expect(contract.connect(owner).claimFunds()).to.be.revertedWith("The crowdfunding campaign is still ongoing.");
    });

    it("should not allow the owner to withdraw funds if the goal is not reached", async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);

      await time.increaseTo(await contract.deadline() + 1n);
      await expect(contract.connect(owner).claimFunds()).to.be.revertedWith("The funding goal has not been reached.");
    }); 

    it("should not allow the owner to withdraw funds more than once", async function () {
      const { contract, addr1, owner, goal } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: goal });
      await time.increaseTo(await contract.deadline() + 1n);
      await contract.connect(owner).claimFunds(); //withdrawal
      await expect(contract.connect(owner).claimFunds()).to.be.revertedWith("Funds have already been withdrawn."); //second attempt
    });

    it("should not allow the owner to withdraw funds if the campaign is canceled", async function () {
      const { contract, owner, addr1, goal } = await loadFixture(deployContractFixture);
      await contract.connect(addr1).contribute({ value: goal });
      await contract.connect(owner).cancelCampaign();
      await expect(contract.connect(owner).claimFunds()).to.be.revertedWith("The crowdfunding campaign has been canceled.");
    });
  });

  //contract refund
  describe("getRefund", function () {
    it("should allow a contributor to withdraw funds after the deadline when goal is not reached", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: amount });
      await time.increaseTo(await contract.deadline() + 1n); //moment after deadline
      const transaction = await contract.connect(addr1).getRefund();
      
      await expect(transaction).to.changeEtherBalances([addr1, contract], [amount, -amount]);
      await expect(transaction).to.emit(contract, "Refunded").withArgs(addr1.address, amount); //emit event
    });

    it("should allow a contributor to withdraw funds if the campaign is canceled", async function () {
      const { contract, owner, addr1, amount } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: amount });
      await contract.connect(owner).cancelCampaign();
      const transaction = await contract.connect(addr1).getRefund();

      await expect(transaction).to.changeEtherBalances([addr1, contract], [amount, -amount]);
      await expect(transaction).to.emit(contract, "Refunded").withArgs(addr1.address, amount);
    });

    it("should not allow non-contributors to withdraw funds", async function () {
      const { contract, addr1 } = await loadFixture(deployContractFixture);
      await time.increaseTo(await contract.deadline() + 1n);
      await expect(contract.connect(addr1).getRefund()).to.be.revertedWith("No contributions to refund.");
    });

    it("should not allow a contributor to refund after the deadline if the goal was reached", async function () {
      const { contract, addr1, goal } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: goal });
      await time.increaseTo(await contract.deadline() + 1n);
      await expect(contract.connect(addr1).getRefund()).to.be.revertedWith("Refunds are only available after the campaign ends or fails.");
    });

    it("should not allow a contributor to refund before the deadline if the campaign is not canceled", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);
      await contract.connect(addr1).contribute({ value: amount });
      await expect(contract.connect(addr1).getRefund()).to.be.revertedWith("Refunds are only available after the campaign ends or fails.");
    });

    it("should not allow the contributor to receive a refund more than once", async function () {
      const { contract, addr1, amount } = await loadFixture(deployContractFixture);

      await contract.connect(addr1).contribute({ value: amount });
      await time.increaseTo(await contract.deadline() + 1n);
      await expect(contract.connect(addr1).getRefund()).to.changeEtherBalances([addr1, contract], [amount, -amount]); //refund
      await expect(contract.connect(addr1).getRefund()).to.be.revertedWith("No contributions to refund."); //second attempt
    });
  });

  //campaign cancellation
  describe("cancelCampaign", function () {
    it("should allow the organizer to cancel the campaign", async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);

      await contract.connect(owner).cancelCampaign();
      expect(await contract.canceled()).to.equal(true);
    });

    it("should not allow non-organizers to cancel", async function () {
      const { contract, addr1 } = await loadFixture(deployContractFixture);

      await expect(contract.connect(addr1).cancelCampaign()).to.be.revertedWith("Only the organizer can cancel the campaign.");
    });

    it("should not allow cancelling twice", async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);

      await contract.connect(owner).cancelCampaign();
      await expect(contract.connect(owner).cancelCampaign()).to.be.revertedWith("The crowdfunding campaign has already been canceled.");
    });

    it("should not allow cancelling after the deadline", async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);

      await time.increaseTo(await contract.deadline() + 1n);
      await expect(contract.connect(owner).cancelCampaign()).to.be.revertedWith("The crowdfunding campaign has ended.");
    });
  });


});