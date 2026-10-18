import React from "react";

export function Transfer({ 
    canContribute,
    canClaim,
    canRefund,
    txBeingSent,
    contributeEth,
    claimFunds,
    getRefund,
 }) {
  return (
    <div>
      <h4>Actions</h4>
      
      {canContribute && (
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const formData = new FormData(event.target);
            const amount = formData.get("amount");

            if (amount) {
                contributeEth(amount);
            }
        }}
      > 
        <div className="form-group">
          <label>Amount to contribute (ETH)</label>
          <input
            className="form-control"
            type="number"
            step="0.001"
            min="0.001"
            name="amount"
            placeholder="0.001"
            required
          />
        </div>
        <div className="form-group">
          <input 
            className="btn btn-primary" 
            type="submit" 
            value="Contribute" 
            disabled={txBeingSent}
          />
        </div>
      </form>
     )}

     {canClaim && (
        <button
            className="btn btn-success"
            onClick={claimFunds}
            disabled={txBeingSent}
        >
            Claim Funds
        </button>
     )}

     {canRefund && (
        <button
            className="btn btn-danger"
            onClick={getRefund}
            disabled={txBeingSent}
        >
            Get Refund
        </button>
     )}

    </div>
  );
}