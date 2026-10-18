import React from "react";
import { ethers } from "ethers";

import CrowdfundingArtifact from "./contracts/Crowdfunding.json";
import contractAddresses from "./contracts/contract-address.json";

// All the logic of this dapp is contained in the Dapp component.
// These other components are just presentational ones: they don't have any
// logic. They just render HTML.
import { NoWalletDetected } from "./components/NoWalletDetected";
import { ConnectWallet } from "./components/ConnectWallet";
import { Loading } from "./components/Loading";
import { Transfer } from "./components/Transfer";
import { TransactionErrorMessage } from "./components/TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./components/WaitingForTransactionMessage";
import { SelectCampaign } from "./components/SelectCampaign";

// This is the default id used by the Sepolia Network
const SEPOLIA_NETWORK_ID = "11155111";
const SEPOLIA_NETWORK_ID_HEX = "0xaa36a7";

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Crowdfunding contract
//   3. Polls the user balance to keep it updated.
//   4. Transfers tokens by sending transactions
//   5. Renders the whole application
export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    // We store multiple things in Dapp's state.
    // You don't need to follow this pattern, but it's an useful example.
    this.initialState = {
      selectedCampaign: undefined,
      campaign: undefined,
      allTimeContributions: undefined,
      selectedAddress: undefined,
      txBeingSent: undefined,
      transactionError: undefined,
      networkError: undefined,
    };

    this.state = this.initialState;
  }

  render() {
    // Ethereum wallets inject the window.ethereum object. If it hasn't been
    // injected, we instruct the user to install a wallet.
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // The next thing we need to do, is to ask the user to connect their wallet.
    // When the wallet gets connected, we are going to save the users's address
    // in the component's state. So, if it hasn't been saved yet, we have
    // to show the ConnectWallet component.
    //
    // Note that we pass it a callback that is going to be called when the user
    // clicks a button. This callback just calls the _connectWallet method.
    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet 
          connectWallet={() => this._connectWallet()} 
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }

    if (!this.state.selectedCampaign) {
      return (
        <SelectCampaign
          selectedAddress={this.state.selectedAddress}
          contractAddresses={contractAddresses}
          selectCampaign={(id) => this._selectCampaign(id)}
          disconnectUser={() => this._disconnectWallet()}
        />
      );
    }

    // If the crowdfunding data or the user's balance hasn't loaded yet, we show
    // a loading component.
    const { campaign, allTimeContributions } = this.state;
    if (!campaign || !allTimeContributions) {
      return <Loading />;
    }

    const now = Math.floor(Date.now() / 1000);
    const deadlinePassed = now >= campaign.deadline;
    const goalReached = campaign.totalMoneyRaised.gte(campaign.goal);
    const isOrganizer = this.state.selectedAddress.toLowerCase() == campaign.organizer.toLowerCase();
    
    const canContribute = !deadlinePassed;
    const canClaim = isOrganizer && deadlinePassed && goalReached && !campaign.alreadyWithdrawn;
    const canRefund = deadlinePassed && !goalReached && allTimeContributions.gt(0);

    var status = "";
    if (!deadlinePassed) {
      status = "In progress"
    } else if (goalReached && !campaign.alreadyWithdrawn) {
      status = "Goal reached - Waiting for organizer to withdraw";
    } else if (goalReached && campaign.alreadyWithdrawn) {
      status = "Goal reached - Organizer has withdrawn the funds";
    } else {
      status = "Goal not reached - Contributors can get a refund";
    }

    return (
      <div className="container p-4">
        {/* Title and account information */}
        <div className="row">
          <div className="col-12">
            <button className="btn btn-primary mb-2" onClick={() => this._backToCampaigns()}>
              Back to all campaigns
            </button>
            <div className="d-flex justify-content-between align-items-center">
              <h1>Crowdfunding campaign</h1>
              <button className="btn btn-secondary mb-2 mr-2"onClick={() => this._disconnectWallet()}>
                  Log out
              </button>
            </div>
            <p> Connected as <b>{this.state.selectedAddress}</b>.</p>
          </div>
        </div>

        <hr />

        {/* Contract information */}
        <div className="row">
          <div className="col-12">
            <p><b>Contract information</b></p>
            <p>Organizer: <b>{campaign.organizer}</b></p>
            <p>Goal: <b>{ethers.utils.formatEther(campaign.goal)} ETH</b></p>
            <p>Raised: <b>{ethers.utils.formatEther(campaign.totalMoneyRaised)} ETH</b></p>
            <p>Deadline:{" "}<b>{new Date(campaign.deadline * 1000).toLocaleString()}</b></p>
            <p>Status: <b>{status}</b></p>
            <p>
              Your contribution:{" "}
              <b>{ethers.utils.formatEther(allTimeContributions)} ETH</b>
            </p>
          </div>
        </div>

        <hr />

        <div className="row">
          <div className="col-12">
            {this.state.txBeingSent && (
              <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
            )}
            {this.state.transactionError && (
              <TransactionErrorMessage
                message={this._getRpcErrorMessage(this.state.transactionError)}
                dismiss={() => this._dismissTransactionError()}
              />
            )}
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            <Transfer
              canContribute={canContribute}
              canClaim={canClaim}
              canRefund={canRefund}
              txBeingSent={this.state.txBeingSent}
              contributeEth={(amount) => this._contributeEth(amount)}
              claimFunds={() => this._claimFunds()}
              getRefund={() => this._getRefund()}
            />
          </div>
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    // We poll the user's balance, so we have to stop doing that when Dapp
    // gets unmounted
    this._stopPollingData();
  }




  async _connectWallet() {
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.

    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });

    // To connect to the user's wallet, we have to run this method.
    // It returns a promise that will resolve to the user's address.
    const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Once we have the address, we can initialize the application.

    // First we check the network
    const isValidNetwork = await this._checkNetwork();
    if (!isValidNetwork) return;

    this._initialize(selectedAddress);

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      this._stopPollingData();
      // `accountsChanged` event can be triggered with an undefined newAddress.
      // This happens when the user removes the Dapp from the "Connected
      // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
      // To avoid errors, we reset the dapp state 
      if (newAddress === undefined) {
        return this._resetState();
      }
      this._initialize(newAddress);
    });
  }

  async _disconnectWallet() {
    this._stopPollingData();
    this._contract = undefined;
    await window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    this._resetState();
  }


  _initialize(userAddress) {
    // This method initializes the dapp

    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
    });

    // Fetching the crowdfunding data and the user's balance are specific to this
    // sample project, but you can reuse the same initialization pattern.
    this._initializeEthers();
    if (this.state.selectedCampaign) {
      this._selectCampaign(this.state.selectedCampaign, userAddress);
    }
  }

  _initializeEthers() {
    // We first initialize ethers by creating a provider using window.ethereum
    this._provider = new ethers.providers.Web3Provider(window.ethereum);
  }

  _initializeContract(campaignId) {
    this._contract = new ethers.Contract(
      contractAddresses[campaignId],
      CrowdfundingArtifact.abi,
      this._provider.getSigner(0)
    );
  }



  _selectCampaign(campaignId, userAddress = this.state.selectedAddress) {
    this._stopPollingData();
    this.setState({
      selectedCampaign: campaignId,
      campaign: undefined,
      allTimeContributions: undefined,
      transactionError: undefined, //error is campaign-based
    });
    this._initializeContract(campaignId);
    this._getCampaignData(userAddress);
    this._startPollingData();
  }

  _backToCampaigns() {
    this._stopPollingData();
    this._contract = undefined;
    this.setState({
      selectedCampaign: undefined,
      campaign: undefined,
      allTimeContributions: undefined,
      transactionError: undefined,
    });
  }


  // The next two methods are needed to start and stop polling data. While
  // the data being polled here is specific to this example, you can use this
  // pattern to read any data from your contracts.
  //
  // Note that if you don't need it to update in near real time, you probably
  // don't need to poll it. If that's the case, you can just fetch it when you
  // initialize the app, as we do with the crowdfunding data.
  _startPollingData() {
    this._pollDataInterval = setInterval(() => this._getCampaignData(), 10000);
  }

  _stopPollingData() {
    clearInterval(this._pollDataInterval);
    this._pollDataInterval = undefined;
  }



  // The next two methods just read from the contract and store the results
  // in the component state.
  async _getCampaignData(userAddress = this.state.selectedAddress) {
    const contract = this._contract;
    if (!contract) return;
    const organizer = await contract.organizer();
    const goal = await contract.goal();
    const deadline = await contract.deadline();
    const totalMoneyRaised = await contract.totalMoneyRaised();
    const alreadyWithdrawn = await contract.alreadyWithdrawn();
    const givenMoney = await contract.contributionsOf(userAddress);

    // User changed contract while retrieving data
    if (this._contract !== contract) return;

    this.setState({ 
      campaign: { 
        organizer: organizer, 
        goal: goal, 
        deadline: deadline, 
        totalMoneyRaised: totalMoneyRaised, 
        alreadyWithdrawn: alreadyWithdrawn,
      }, 
      allTimeContributions : givenMoney 
    });
  }



  // This generic method sends an ethereum transaction to transfer eth.
  async _transferEth(transferFunc) {
    try {
      this._dismissTransactionError();

      const tx = await transferFunc();
      this.setState({ txBeingSent: tx.hash });

      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      await this._getCampaignData();
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) return;
      console.error(error);
      this.setState({ transactionError: error });
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }


  
  //wrapper functions of the contract methods
  async _contributeEth(amount) {
    const value = ethers.utils.parseEther(amount);
    await this._transferEth(() => this._contract.contribute({ value }));
  }

  async _claimFunds() {
    await this._transferEth(() => this._contract.claimFunds());
  }

  async _getRefund() {
    await this._transferEth(() => this._contract.getRefund());
  }



  // This method just clears part of the state.
  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  // This is an utility method that turns an RPC error into a human readable
  // message.
  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }
    return error.message;
  }

  // This method resets the state
  _resetState() {
    this.setState(this.initialState);
  }

  // This method connects the user to the sepolia network.
  async _switchChain() {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_NETWORK_ID_HEX }],
    });
  }

  async _checkNetwork() {
    if (window.ethereum.networkVersion !== SEPOLIA_NETWORK_ID) {
      await this._switchChain();
      return true;
    }
    return true;
  }
}