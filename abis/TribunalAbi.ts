export const TribunalAbi = [
  // ============================================================================
  // EVENTS
  // ============================================================================
  {
    type: "event",
    name: "Cancel",
    inputs: [
      {
        name: "sponsor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "claimHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Dispatch",
    inputs: [
      {
        name: "dispatchTarget",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "chainId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "claimant",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "claimHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Fill",
    inputs: [
      {
        name: "sponsor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "claimant",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "claimHash",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "fillRecipients",
        type: "tuple[]",
        indexed: false,
        internalType: "struct Tribunal.FillRecipient[]",
        components: [
          {
            name: "fillAmount",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "recipient",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "claimAmounts",
        type: "uint256[]",
        indexed: false,
        internalType: "uint256[]",
      },
      {
        name: "targetBlock",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FillWithClaim",
    inputs: [
      {
        name: "sponsor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "claimant",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "claimHash",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "fillRecipients",
        type: "tuple[]",
        indexed: false,
        internalType: "struct Tribunal.FillRecipient[]",
        components: [
          {
            name: "fillAmount",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "recipient",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "claimAmounts",
        type: "uint256[]",
        indexed: false,
        internalType: "uint256[]",
      },
      {
        name: "targetBlock",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  // ============================================================================
  // FUNCTIONS
  // ============================================================================
  {
    type: "function",
    name: "fill",
    inputs: [
      {
        name: "compact",
        type: "tuple",
        internalType: "struct Tribunal.BatchCompact",
        components: [
          { name: "arbiter", type: "address", internalType: "address" },
          { name: "sponsor", type: "address", internalType: "address" },
          { name: "nonce", type: "uint256", internalType: "uint256" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "commitments",
            type: "tuple[]",
            internalType: "struct Tribunal.Lock[]",
            components: [
              { name: "lockTag", type: "bytes12", internalType: "bytes12" },
              { name: "token", type: "address", internalType: "address" },
              { name: "amount", type: "uint256", internalType: "uint256" },
            ],
          },
        ],
      },
      {
        name: "mandate",
        type: "tuple",
        internalType: "struct Tribunal.FillParameters",
        components: [
          { name: "chainId", type: "uint256", internalType: "uint256" },
          { name: "tribunal", type: "address", internalType: "address" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "components",
            type: "tuple[]",
            internalType: "struct Tribunal.FillComponent[]",
            components: [
              { name: "fillToken", type: "address", internalType: "address" },
              { name: "minimumFillAmount", type: "uint256", internalType: "uint256" },
              { name: "recipient", type: "address", internalType: "address" },
              { name: "applyScaling", type: "bool", internalType: "bool" },
            ],
          },
          { name: "baselinePriorityFee", type: "uint256", internalType: "uint256" },
          { name: "scalingFactor", type: "uint256", internalType: "uint256" },
          { name: "priceCurve", type: "uint256[]", internalType: "uint256[]" },
          {
            name: "recipientCallback",
            type: "tuple[]",
            internalType: "struct Tribunal.RecipientCallback[]",
            components: [
              { name: "chainId", type: "uint256", internalType: "uint256" },
              {
                name: "compact",
                type: "tuple",
                internalType: "struct Tribunal.BatchCompact",
                components: [
                  { name: "arbiter", type: "address", internalType: "address" },
                  { name: "sponsor", type: "address", internalType: "address" },
                  { name: "nonce", type: "uint256", internalType: "uint256" },
                  { name: "expires", type: "uint256", internalType: "uint256" },
                  {
                    name: "commitments",
                    type: "tuple[]",
                    internalType: "struct Tribunal.Lock[]",
                    components: [
                      { name: "lockTag", type: "bytes12", internalType: "bytes12" },
                      { name: "token", type: "address", internalType: "address" },
                      { name: "amount", type: "uint256", internalType: "uint256" },
                    ],
                  },
                ],
              },
              { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
              { name: "context", type: "bytes", internalType: "bytes" },
            ],
          },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      {
        name: "adjustment",
        type: "tuple",
        internalType: "struct Tribunal.Adjustment",
        components: [
          { name: "adjuster", type: "address", internalType: "address" },
          { name: "fillIndex", type: "uint256", internalType: "uint256" },
          { name: "targetBlock", type: "uint256", internalType: "uint256" },
          { name: "supplementalPriceCurve", type: "uint256[]", internalType: "uint256[]" },
          { name: "validityConditions", type: "bytes32", internalType: "bytes32" },
          { name: "adjustmentAuthorization", type: "bytes", internalType: "bytes" },
        ],
      },
      { name: "fillHashes", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "claimant", type: "bytes32", internalType: "bytes32" },
      { name: "fillBlock", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "claimHash", type: "bytes32", internalType: "bytes32" },
      { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
      { name: "fillAmounts", type: "uint256[]", internalType: "uint256[]" },
      { name: "claimAmounts", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fillAndDispatch",
    inputs: [
      {
        name: "compact",
        type: "tuple",
        internalType: "struct Tribunal.BatchCompact",
        components: [
          { name: "arbiter", type: "address", internalType: "address" },
          { name: "sponsor", type: "address", internalType: "address" },
          { name: "nonce", type: "uint256", internalType: "uint256" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "commitments",
            type: "tuple[]",
            internalType: "struct Tribunal.Lock[]",
            components: [
              { name: "lockTag", type: "bytes12", internalType: "bytes12" },
              { name: "token", type: "address", internalType: "address" },
              { name: "amount", type: "uint256", internalType: "uint256" },
            ],
          },
        ],
      },
      {
        name: "mandate",
        type: "tuple",
        internalType: "struct Tribunal.FillParameters",
        components: [
          { name: "chainId", type: "uint256", internalType: "uint256" },
          { name: "tribunal", type: "address", internalType: "address" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "components",
            type: "tuple[]",
            internalType: "struct Tribunal.FillComponent[]",
            components: [
              { name: "fillToken", type: "address", internalType: "address" },
              { name: "minimumFillAmount", type: "uint256", internalType: "uint256" },
              { name: "recipient", type: "address", internalType: "address" },
              { name: "applyScaling", type: "bool", internalType: "bool" },
            ],
          },
          { name: "baselinePriorityFee", type: "uint256", internalType: "uint256" },
          { name: "scalingFactor", type: "uint256", internalType: "uint256" },
          { name: "priceCurve", type: "uint256[]", internalType: "uint256[]" },
          {
            name: "recipientCallback",
            type: "tuple[]",
            internalType: "struct Tribunal.RecipientCallback[]",
            components: [
              { name: "chainId", type: "uint256", internalType: "uint256" },
              {
                name: "compact",
                type: "tuple",
                internalType: "struct Tribunal.BatchCompact",
                components: [
                  { name: "arbiter", type: "address", internalType: "address" },
                  { name: "sponsor", type: "address", internalType: "address" },
                  { name: "nonce", type: "uint256", internalType: "uint256" },
                  { name: "expires", type: "uint256", internalType: "uint256" },
                  {
                    name: "commitments",
                    type: "tuple[]",
                    internalType: "struct Tribunal.Lock[]",
                    components: [
                      { name: "lockTag", type: "bytes12", internalType: "bytes12" },
                      { name: "token", type: "address", internalType: "address" },
                      { name: "amount", type: "uint256", internalType: "uint256" },
                    ],
                  },
                ],
              },
              { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
              { name: "context", type: "bytes", internalType: "bytes" },
            ],
          },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      {
        name: "adjustment",
        type: "tuple",
        internalType: "struct Tribunal.Adjustment",
        components: [
          { name: "adjuster", type: "address", internalType: "address" },
          { name: "fillIndex", type: "uint256", internalType: "uint256" },
          { name: "targetBlock", type: "uint256", internalType: "uint256" },
          { name: "supplementalPriceCurve", type: "uint256[]", internalType: "uint256[]" },
          { name: "validityConditions", type: "bytes32", internalType: "bytes32" },
          { name: "adjustmentAuthorization", type: "bytes", internalType: "bytes" },
        ],
      },
      { name: "fillHashes", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "claimant", type: "bytes32", internalType: "bytes32" },
      { name: "fillBlock", type: "uint256", internalType: "uint256" },
      {
        name: "dispatchParameters",
        type: "tuple",
        internalType: "struct Tribunal.DispatchParameters",
        components: [
          { name: "chainId", type: "uint256", internalType: "uint256" },
          { name: "target", type: "address", internalType: "address" },
          { name: "value", type: "uint256", internalType: "uint256" },
          { name: "context", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "claimHash", type: "bytes32", internalType: "bytes32" },
      { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
      { name: "fillAmounts", type: "uint256[]", internalType: "uint256[]" },
      { name: "claimAmounts", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimAndFill",
    inputs: [
      {
        name: "claim",
        type: "tuple",
        internalType: "struct Tribunal.BatchClaim",
        components: [
          {
            name: "compact",
            type: "tuple",
            internalType: "struct Tribunal.BatchCompact",
            components: [
              { name: "arbiter", type: "address", internalType: "address" },
              { name: "sponsor", type: "address", internalType: "address" },
              { name: "nonce", type: "uint256", internalType: "uint256" },
              { name: "expires", type: "uint256", internalType: "uint256" },
              {
                name: "commitments",
                type: "tuple[]",
                internalType: "struct Tribunal.Lock[]",
                components: [
                  { name: "lockTag", type: "bytes12", internalType: "bytes12" },
                  { name: "token", type: "address", internalType: "address" },
                  { name: "amount", type: "uint256", internalType: "uint256" },
                ],
              },
            ],
          },
          { name: "sponsorSignature", type: "bytes", internalType: "bytes" },
          { name: "allocatorSignature", type: "bytes", internalType: "bytes" },
        ],
      },
      {
        name: "mandate",
        type: "tuple",
        internalType: "struct Tribunal.FillParameters",
        components: [
          { name: "chainId", type: "uint256", internalType: "uint256" },
          { name: "tribunal", type: "address", internalType: "address" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "components",
            type: "tuple[]",
            internalType: "struct Tribunal.FillComponent[]",
            components: [
              { name: "fillToken", type: "address", internalType: "address" },
              { name: "minimumFillAmount", type: "uint256", internalType: "uint256" },
              { name: "recipient", type: "address", internalType: "address" },
              { name: "applyScaling", type: "bool", internalType: "bool" },
            ],
          },
          { name: "baselinePriorityFee", type: "uint256", internalType: "uint256" },
          { name: "scalingFactor", type: "uint256", internalType: "uint256" },
          { name: "priceCurve", type: "uint256[]", internalType: "uint256[]" },
          {
            name: "recipientCallback",
            type: "tuple[]",
            internalType: "struct Tribunal.RecipientCallback[]",
            components: [
              { name: "chainId", type: "uint256", internalType: "uint256" },
              {
                name: "compact",
                type: "tuple",
                internalType: "struct Tribunal.BatchCompact",
                components: [
                  { name: "arbiter", type: "address", internalType: "address" },
                  { name: "sponsor", type: "address", internalType: "address" },
                  { name: "nonce", type: "uint256", internalType: "uint256" },
                  { name: "expires", type: "uint256", internalType: "uint256" },
                  {
                    name: "commitments",
                    type: "tuple[]",
                    internalType: "struct Tribunal.Lock[]",
                    components: [
                      { name: "lockTag", type: "bytes12", internalType: "bytes12" },
                      { name: "token", type: "address", internalType: "address" },
                      { name: "amount", type: "uint256", internalType: "uint256" },
                    ],
                  },
                ],
              },
              { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
              { name: "context", type: "bytes", internalType: "bytes" },
            ],
          },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      {
        name: "adjustment",
        type: "tuple",
        internalType: "struct Tribunal.Adjustment",
        components: [
          { name: "adjuster", type: "address", internalType: "address" },
          { name: "fillIndex", type: "uint256", internalType: "uint256" },
          { name: "targetBlock", type: "uint256", internalType: "uint256" },
          { name: "supplementalPriceCurve", type: "uint256[]", internalType: "uint256[]" },
          { name: "validityConditions", type: "bytes32", internalType: "bytes32" },
          { name: "adjustmentAuthorization", type: "bytes", internalType: "bytes" },
        ],
      },
      { name: "fillHashes", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "claimant", type: "bytes32", internalType: "bytes32" },
      { name: "fillBlock", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "claimHash", type: "bytes32", internalType: "bytes32" },
      { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
      { name: "fillAmounts", type: "uint256[]", internalType: "uint256[]" },
      { name: "claimAmounts", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cancel",
    inputs: [
      {
        name: "compact",
        type: "tuple",
        internalType: "struct Tribunal.BatchCompact",
        components: [
          { name: "arbiter", type: "address", internalType: "address" },
          { name: "sponsor", type: "address", internalType: "address" },
          { name: "nonce", type: "uint256", internalType: "uint256" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "commitments",
            type: "tuple[]",
            internalType: "struct Tribunal.Lock[]",
            components: [
              { name: "lockTag", type: "bytes12", internalType: "bytes12" },
              { name: "token", type: "address", internalType: "address" },
              { name: "amount", type: "uint256", internalType: "uint256" },
            ],
          },
        ],
      },
      { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "claimHash", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelAndDispatch",
    inputs: [
      {
        name: "compact",
        type: "tuple",
        internalType: "struct Tribunal.BatchCompact",
        components: [
          { name: "arbiter", type: "address", internalType: "address" },
          { name: "sponsor", type: "address", internalType: "address" },
          { name: "nonce", type: "uint256", internalType: "uint256" },
          { name: "expires", type: "uint256", internalType: "uint256" },
          {
            name: "commitments",
            type: "tuple[]",
            internalType: "struct Tribunal.Lock[]",
            components: [
              { name: "lockTag", type: "bytes12", internalType: "bytes12" },
              { name: "token", type: "address", internalType: "address" },
              { name: "amount", type: "uint256", internalType: "uint256" },
            ],
          },
        ],
      },
      { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
      {
        name: "dispatchParams",
        type: "tuple",
        internalType: "struct Tribunal.DispatchParameters",
        components: [
          { name: "chainId", type: "uint256", internalType: "uint256" },
          { name: "target", type: "address", internalType: "address" },
          { name: "value", type: "uint256", internalType: "uint256" },
          { name: "context", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "claimHash", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "deriveMandateHash",
    inputs: [
      {
        name: "mandate",
        type: "tuple",
        internalType: "struct Tribunal.Mandate",
        components: [
          { name: "adjuster", type: "address", internalType: "address" },
          {
            name: "fills",
            type: "tuple[]",
            internalType: "struct Tribunal.FillParameters[]",
            components: [
              { name: "chainId", type: "uint256", internalType: "uint256" },
              { name: "tribunal", type: "address", internalType: "address" },
              { name: "expires", type: "uint256", internalType: "uint256" },
              {
                name: "components",
                type: "tuple[]",
                internalType: "struct Tribunal.FillComponent[]",
                components: [
                  { name: "fillToken", type: "address", internalType: "address" },
                  { name: "minimumFillAmount", type: "uint256", internalType: "uint256" },
                  { name: "recipient", type: "address", internalType: "address" },
                  { name: "applyScaling", type: "bool", internalType: "bool" },
                ],
              },
              { name: "baselinePriorityFee", type: "uint256", internalType: "uint256" },
              { name: "scalingFactor", type: "uint256", internalType: "uint256" },
              { name: "priceCurve", type: "uint256[]", internalType: "uint256[]" },
              {
                name: "recipientCallback",
                type: "tuple[]",
                internalType: "struct Tribunal.RecipientCallback[]",
                components: [
                  { name: "chainId", type: "uint256", internalType: "uint256" },
                  {
                    name: "compact",
                    type: "tuple",
                    internalType: "struct Tribunal.BatchCompact",
                    components: [
                      { name: "arbiter", type: "address", internalType: "address" },
                      { name: "sponsor", type: "address", internalType: "address" },
                      { name: "nonce", type: "uint256", internalType: "uint256" },
                      { name: "expires", type: "uint256", internalType: "uint256" },
                      {
                        name: "commitments",
                        type: "tuple[]",
                        internalType: "struct Tribunal.Lock[]",
                        components: [
                          { name: "lockTag", type: "bytes12", internalType: "bytes12" },
                          { name: "token", type: "address", internalType: "address" },
                          { name: "amount", type: "uint256", internalType: "uint256" },
                        ],
                      },
                    ],
                  },
                  { name: "mandateHash", type: "bytes32", internalType: "bytes32" },
                  { name: "context", type: "bytes", internalType: "bytes" },
                ],
              },
              { name: "salt", type: "bytes32", internalType: "bytes32" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
] as const;
