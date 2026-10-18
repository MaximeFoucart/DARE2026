//SPDX-License-Identifier: UNLICENSED

// Solidity files have to start with this pragma.
// It will be used by the Solidity compiler to validate its version.
pragma solidity ^0.8.0;

//factory method for creating crowdfunding-based smart contracts.
contract Crowdfunding {

    address public immutable organizer;
    mapping(address => uint) public contributions;
    
    uint public immutable goal;
    uint public immutable deadline;
    uint public totalMoneyRaised;
    uint public immutable upperLimit; // upper limit for contributions
    bool public alreadyWithdrawn;
    bool public canceled;

    //events to notify front-end
    //added indexed as result of the static analysis tool
    event Contributed(address indexed contributor, uint amount);
    event Withdrawn(address indexed organizer, uint amount);
    event Refunded(address indexed contributor, uint amount);
    event Canceled(address indexed organizer);

    //Contract initialization.
    constructor(uint numberOfDays, uint amount) {
        require(numberOfDays > 0, "Number of days must be greater than zero.");
        require(amount > 0, "Funding goal must be greater than zero.");
        organizer = msg.sender;
        deadline = block.timestamp + numberOfDays * 1 days;
        goal = amount;
        upperLimit = 10 * amount; // Set the upper limit to 10 times the goal
    }

    //A function to contribute to the crowdfunding campaign.
    //payable allows the function to receive ETH contributions (stored in the contract's balance)
    function contribute() external payable {
        require(block.timestamp < deadline, "The crowdfunding campaign has ended.");
        require(!canceled, "The crowdfunding campaign has been canceled.");
        require(msg.value > 0, "Contribution amount must be greater than zero.");
        require(msg.value <= upperLimit - totalMoneyRaised, "Contribution amount exceeds the upper limit.");

        contributions[msg.sender] += msg.value;
        totalMoneyRaised += msg.value;
        // Notify off-chain applications of the contribution.
        emit Contributed(msg.sender, msg.value);
    }

    /*
    //checks if the funding goal has been reached
    function isGoalReached() external returns (bool) {
        bool goalReached = totalMoneyRaised >= goal;
        if (goalReached) {
            emit GoalReached(totalMoneyRaised);
        }
        return goalReached;
    }
    */
    
    //allows the organizer to redeem the funds when the goal is met and deadline reached
    function claimFunds() external {
        require(msg.sender == organizer, "Only the organizer can withdraw funds.");
        require(!canceled, "The crowdfunding campaign has been canceled.");
        require(block.timestamp >= deadline, "The crowdfunding campaign is still ongoing.");
        require(totalMoneyRaised >= goal, "The funding goal has not been reached.");
        require(!alreadyWithdrawn, "Funds have already been withdrawn.");

        alreadyWithdrawn = true;
        // Transfer the funds to the organizer.
        (bool success, ) = organizer.call{value: totalMoneyRaised}("");
        require(success, "Transfer failed.");

        emit Withdrawn(organizer, totalMoneyRaised);
    }

    //allows contributors to get a  refund after the deadline is reached when the goal is not met
    function getRefund() external {
        require(canceled || (block.timestamp >= deadline && totalMoneyRaised < goal), "Refunds are only available after the campaign ends or fails.");

        uint256 contributedAmount = contributions[msg.sender];
        require(contributedAmount > 0, "No contributions to refund.");

        contributions[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: contributedAmount}("");
        require(success, "Refund transfer failed.");
        emit Refunded(msg.sender, contributedAmount);
    }

    //read-only function to retrieve the contribution amount of a given account
    function contributionsOf(address account) external view returns (uint256) {
        return contributions[account];
    }

    //method to cancel a campaign before the deadline, enabling the refund of all contributions
    function cancelCampaign() external {
        require(msg.sender == organizer, "Only the organizer can cancel the campaign.");
        require(block.timestamp < deadline, "The crowdfunding campaign has ended.");
        require(!alreadyWithdrawn, "Funds have already been withdrawn.");
        require(!canceled, "The crowdfunding campaign has already been canceled.");
        canceled = true;
        emit Canceled(organizer);
    }
}