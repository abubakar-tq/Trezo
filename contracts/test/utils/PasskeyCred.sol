// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/modules/Types.sol";

library PassKeyDemo {
    function getPasskeyInit(uint256 index) external pure returns (PasskeyTypes.PasskeyInit memory) {
        PasskeyTypes.PasskeyInit[] memory passkeys = new PasskeyTypes.PasskeyInit[](2);
        passkeys[0] = PasskeyTypes.PasskeyInit({
            idRaw: 0xb976cb58a15d247afc49d3015e7a45b962532a388c5c2d6225ef7ba3bd494b7d,
            px: uint256(0xc92b6c998c854fcb69cff745bbc83c69cd3e1f3b2904f2cfd7e5a9119ee8eb38),
            py: uint256(0xd64d667544491335c127c62471c5bbca05d1a3aa9641989f964f7cd26504a45d),
            rpIdHash: 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945
        });
        passkeys[1] = PasskeyTypes.PasskeyInit({
            idRaw: 0x8b3d8b076d2577ee4636b431cda59668392b193126d0de23df96ce85f06b592e,
            px: uint256(0x42a4555a7f347ad2a6d94a338f6b23605ec0aa5395189dbcca7698cd4433ef34),
            py: uint256(0x0e6ab23954b8c24eb5c909bc95421d241ed2b04bbc47bc73f7c60785d0d7ecd4),
            rpIdHash: 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945
        });
        require(index < passkeys.length, "Index out of bounds");
        return passkeys[index];
    }

    function getPasskeyCount() external pure returns (uint256) {
        return 2;
    }
}
