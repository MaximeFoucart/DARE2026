const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { parseEther } = require("ethers");

const CrowdfundingModule = buildModule("CrowdfundingModule", (m) => {
  const campaignA  = m.contract("Crowdfunding", [1, parseEther("0.05")], { id: "campaignA" });
  const campaignB  = m.contract("Crowdfunding", [1, parseEther("0.05")], { id: "campaignB" });
  const campaignC  = m.contract("Crowdfunding", [6, parseEther("0.05")], { id: "campaignC" });

  return { campaignA, campaignB, campaignC };
});

module.exports = CrowdfundingModule;
