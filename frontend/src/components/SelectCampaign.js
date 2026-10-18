import React from "react";

export function SelectCampaign({ selectedAddress, contractAddresses, selectCampaign, disconnectUser }) {
  return (
    <div className="container p-4">
        <div className="d-flex justify-content-between align-items-center">
            <h1>Crowdfunding campaigns</h1>
            <button className="btn btn-secondary mb-2 mr-2"onClick={() => disconnectUser()}>
                Log out
            </button>
        </div>
        <p>Connected as <b>{selectedAddress}</b>.</p>
        <hr />
        <p>Select a campaign:</p>
        {Object.keys(contractAddresses).map((id) => (
            <button
                key={id}
                className="btn btn-primary mb-2 mr-2"
                onClick={() => selectCampaign(id)}
            >
                {id}
            </button>
        ))}
    </div>
  );
}