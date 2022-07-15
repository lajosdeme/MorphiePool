// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

/* 
  __  __      _        __  __                  _     _          
 |  \/  |    | |      |  \/  |                | |   (_)         
 | \  / | ___| |_ __ _| \  / | ___  _ __ _ __ | |__  _  ___ ___ 
 | |\/| |/ _ | __/ _` | |\/| |/ _ \| '__| '_ \| '_ \| |/ _ / __|
 | |  | |  __| || (_| | |  | | (_) | |  | |_) | | | | |  __\__ \
 |_|  |_|\___|\__\__,_|_|  |_|\___/|_|  | .__/|_| |_|_|\___|___/
                                        | |                     
                                        |_|                     
 */
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IMemo.sol";

/**
 * @dev The MetaMorphies staking pool contract.
 * Users can stake  their MetaMorphies in this contract, and in return
 * earn $MEMO tokens
 */
contract MorphiePool is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeMath for uint256;

    bytes4 private constant ERC721_RECEIVED = 0x150b7a02;

    /* Meta Morphies NFT contract */
    IERC721 morphies;

    /* $MEMO Token ERC-20 contract */
    IMemo memoToken;

    /* Reward amount & accrue duration */
    uint256 public rewardAmount;
    uint256 public rewardAccrueDuration;

    /* Total $MEMO rewards paid for all stakers */
    uint256 public totalRewardsPaid;

    /* Total number of morphies currently staked in the pool */
    uint256 public totalStakedMorphies;

    /**
    @notice Struct to track what user is staking which tokens, plus the payouts
    @dev tokenIds: array of token ids that the user is staking
    @dev balance: the number of tokens staked by the user
    @dev rewardsOutstanding: amount of rewards that have been collected but not claimed
    @dev rewardsPaid: Total rewards paid to the user
    @dev lastUpdateTime: The last block.timestamp that the rewards have been collected.
    */
    struct Staker {
        uint256[] tokenIds;
        uint256 balance;
        uint256 rewardsOutstanding;
        uint256 rewardsPaid;
        uint256 lastUpdateTime;
    }

    /**
    @notice maps staker address to tokenId to index in tokenIds array
    We keep it outside the Staker struct, so we can copy staker struct to memory when doing operations on it.
    */
    mapping(address => mapping(uint256 => uint256)) stakerTokenIdx;

    /* Mapping addresses to staker structs */
    mapping(address => Staker) public stakers;

    /* Mapping of token id to owner address */
    mapping(uint256 => address) public tokenOwner;

    /* ============================================== */
    /*    ==========       Events      ===========    */
    /* ============================================== */

    /// @notice event emitted when a staking happens
    event Staked(address indexed staker, uint256 indexed tokenId);

    /// @notice event emitted when an unstaking happens
    event Unstaked(address indexed staker, uint256 indexed tokenId);

    /// @notice event emitted when a reward claim happens
    event RewardClaimed(address indexed user, uint256 indexed reward);

    /// @notice event emitted when an emergency unstake happens
    event EmergencyUnstake(address indexed user, uint256 indexed tokenId);

    /// @notice event emitted when the reward params are updated
    event RewardParamsUpdated(
        uint256 indexed rewardAmount,
        uint256 indexed rewardDuration
    );

    /* ============================================== */
    /*  =========       Constructor      ==========   */
    /* ============================================== */
    constructor(
        address _morphieTokenAddress,
        address _memoTokenAddress,
        uint256 _rewardAmount,
        uint256 _rewardAccrueDuration
    ) {
        morphies = IERC721(_morphieTokenAddress);
        memoToken = IMemo(_memoTokenAddress);
        rewardAmount = _rewardAmount;
        rewardAccrueDuration = _rewardAccrueDuration;
    }

    /* ============================================== */
    /*  =========     Admin functions    ==========   */
    /* ============================================== */

    /** 
    Updates the reward amount and reward accrue duration.
    @param reward The reward amount.
    @param duration The reward accrue duration (in seconds).
    */
    function setRewardParams(uint256 reward, uint256 duration)
        external
        onlyOwner
    {
        rewardAmount = reward;
        rewardAccrueDuration = duration;

        emit RewardParamsUpdated(reward, duration);
    }

    /**
    Updates the MetaMorphies address.
    @param _morphies The morphies contract address.
     */
    function setMorphiesAddress(address _morphies) external onlyOwner {
        require(
            _morphies != address(0),
            "MorphiePool: MetaMorphies can't be set to the zero address."
        );
        morphies = IERC721(_morphies);
    }

    /** 
    Updates the MEMO token address.
    @param _memo The memo contract address.
    */
    function setMemoAddress(address _memo) external onlyOwner {
        require(
            _memo != address(0),
            "MorphiePool: MetaMorphies can't be set to the zero address."
        );
        memoToken = IMemo(_memo);
    }

    /* ============================================== */
    /*  ========     External functions    =========  */
    /* ============================================== */

    /** 
    Stakes a Morphie in the staking pool.
    @param tokenId the ID of the Morphie to stake.
    */
    function stake(uint256 tokenId) external nonReentrant {
        _stake(_msgSender(), tokenId);
        _updateRewards(_msgSender());
    }

    /** 
    Stake multiple Morphies in a single transaction.
    @param tokenIds the IDs of the Morphies to stake.
    */
    function stakeBatch(uint256[] memory tokenIds) external nonReentrant {
        for (uint256 i; i < tokenIds.length; i++) {
            _stake(_msgSender(), tokenIds[i]);
        }
        _updateRewards(_msgSender());
    }

    /** 
    Unstake a Morphie staked by the user.
    Unstakes and then pays out all accrued rewards to the user.
    @param tokenId The ID of the Morphie to unstake.
    */
    function unstake(uint256 tokenId) external nonReentrant {
        _claimRewards(_msgSender());
        _unstake(_msgSender(), tokenId);
    }

    /** 
    Unstake multiple Morphies at the same time.
    Pay out all accrued rewards to the user and unstakes the provided tokens.
    @param tokenIds the IDs of the Morphies to unstake.
    */
    function unstakeBatch(uint256[] memory tokenIds) external nonReentrant {
        _claimRewards(_msgSender());
        for (uint256 i; i < tokenIds.length; i++) {
            _unstake(_msgSender(), tokenIds[i]);
        }
    }

    /**
    Emergency unstakes the token ID without caring about rewards.
    @notice EMERGENCY ONLY.
    @param _tokenId the ID of the token to unstake.
    */
    function emergencyUnstake(uint256 _tokenId) external nonReentrant {
        _unstake(_msgSender(), _tokenId);
        emit EmergencyUnstake(_msgSender(), _tokenId);
    }

    /// Claims all rewards accrued by msg.sender.
    function claimRewards() external nonReentrant {
        _claimRewards(_msgSender());
    }

    /* ============================================== */
    /*  =======    External view functions   =======  */
    /* ============================================== */

    /// @return the amount of $MEMO tokens earned by an address
    function earned(address user) external view returns (uint256) {
        uint256 currentEarned = _calculateRewards(user);
        uint256 outstanding = stakers[user].rewardsOutstanding;
        return currentEarned.add(outstanding);
    }

    /// @return the amount of $MEMO tokens earned by an address during the existence of the staking pool
    function lifetimeEarned(address user) external view returns (uint256) {
        Staker memory staker = stakers[user];
        return
            _calculateRewards(user).add(staker.rewardsOutstanding).add(
                staker.rewardsPaid
            );
    }

    /**
    Query all staked tokens by an address.
    @param _user The address for which the token ids are returned
    @return The token ids staked by the user.
    */
    function getStakedTokens(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return stakers[_user].tokenIds;
    }

    /** 
    Query number of staked tokens by an address.
    @param _user The address whose balance is returned
    @return The number of staked tokens for the user
    */
    function getStakedTokensBalance(address _user)
        external
        view
        returns (uint256)
    {
        return stakers[_user].balance;
    }

    /* ============================================== */
    /*  =======    External pure functions   =======  */
    /* ============================================== */

    /// ERC-721 Received callback function.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata /* data */
    ) external pure override returns (bytes4) {
        return ERC721_RECEIVED;
    }

    /* ============================================== */
    /*  =========     Private functions    =========  */
    /* ============================================== */

    /** 
    Stakes a Morphie in the staking pool.
    @param _user The address of the user whose Morphie is being staked.
    @param _tokenId the ID of the Morphie which is being staked.
    */
    function _stake(address _user, uint256 _tokenId) private {
        require(
            morphies.ownerOf(_tokenId) == _user,
            "MorphiePool: Address is not the owner of this Morphie."
        );

        morphies.safeTransferFrom(_user, address(this), _tokenId);

        stakers[_user].tokenIds.push(_tokenId);
        stakerTokenIdx[_user][_tokenId] = stakers[_user].tokenIds.length.sub(1);
        tokenOwner[_tokenId] = _user;

        stakers[_user].balance++;

        totalStakedMorphies++;

        emit Staked(_user, _tokenId);
    }

    /**
    Unstakes a token staked by an address. 
    @notice Claim & update rewards happens in unstake, unstakeBatch not in this function.
    @param _user the address which unstakes the token.
    @param _tokenId the ID of the token that's being unstaked.
    */
    function _unstake(address _user, uint256 _tokenId) private {
        // Check if user owns the token
        require(
            tokenOwner[_tokenId] == _user,
            "MorphiePool: Token is not staked by this address."
        );

        // delete token id from tokenIds array
        _removeToken(_user, _tokenId);

        // delete token id from token owner
        delete tokenOwner[_tokenId];

        //staker balance and total staked has a 1:1 relationship with staked amounts
        //so can't ever underflow
        stakers[_user].balance--;

        // Update totalStakedMorphies
        totalStakedMorphies--;

        // Transfer NFT back to user
        morphies.safeTransferFrom(address(this), _user, _tokenId);

        emit Unstaked(_user, _tokenId);
    }

    /** 
    Claims rewards accrued by a user.
    @param _claimer The address whose rewards are being paid out.
    */
    function _claimRewards(address _claimer) private {
        uint256 outstanding = stakers[_claimer].rewardsOutstanding;
        uint256 rewards = outstanding.add(_calculateRewards(_claimer));

        if (rewards == 0) {
            return;
        }

        totalRewardsPaid += rewards;

        stakers[_claimer].rewardsOutstanding = 0;
        stakers[_claimer].rewardsPaid += rewards;
        stakers[_claimer].lastUpdateTime = block.timestamp;

        memoToken.mintRewards(_claimer, rewards);

        emit RewardClaimed(_claimer, rewards);
    }

    /** 
    Updates the rewards accrued by a user.
    @param _user The address whose rewards we're updating.
    */
    function _updateRewards(address _user) private {
        if (stakers[_user].lastUpdateTime == 0) {
            stakers[_user].lastUpdateTime = block.timestamp;
            return;
        }

        stakers[_user].rewardsOutstanding += _calculateRewards(_user);
        stakers[_user].lastUpdateTime = block.timestamp;
    }

    /** 
    Removes a token from the contract's ownership tracking data structures.
    Avoids gaps in the tokenIds array that result from simply using `delete`.
    The operation is O(1). Does not preserve the order in which the tokens are recorded.
    @param _user The address whose token we are removing from the contract.
    @param _tokenId The token id to remove from the contract.
     */
    function _removeToken(address _user, uint256 _tokenId) private {
        // Get the index where the token id is stored in the staker's tokenIds array.
        uint256 idx = stakerTokenIdx[_user][_tokenId];

        // Copy the token ids array into memory.
        uint256[] memory _tokenIds = stakers[_user].tokenIds;

        // Delete the token id from the mapping that stores the token's index in the token ids array
        delete stakerTokenIdx[_user][_tokenId];

        // If it is the last token we are deleting there is no need to swap the indexes
        if (idx == _tokenIds.length - 1) {
            stakers[_user].tokenIds.pop();
            return;
        }

        // The index of the last token is set to the index that we will delete from the token ids array in the next step.
        // Necessary because the deleted item will be replaced with the last item, and the last item popped from the array.
        stakerTokenIdx[_user][_tokenIds[_tokenIds.length - 1]] = idx;

        // Set the last element in the array 
        stakers[_user].tokenIds[idx] = _tokenIds[_tokenIds.length - 1];

        // 5. pop the last element
        stakers[_user].tokenIds.pop();
    }

    /* ============================================== */
    /*  =========  Private view functions  =========  */
    /* ============================================== */

    /** 
    Calculates the rewards earned by a user.
    @param _staker The address of the user.
    Returns the rewards earned by the user.
    */
    function _calculateRewards(address _staker)
        private
        view
        returns (uint256 rewards)
    {
        Staker memory staker = stakers[_staker];

        if (staker.balance == 0) {
            return 0;
        }

        uint256 currentBlock = block.timestamp;
        uint256 lastUpdateTime = staker.lastUpdateTime;

        uint256 stakeDuration = (
            ((currentBlock.sub(lastUpdateTime)).mul(10**18)).div(
                rewardAccrueDuration
            )
        );

        uint256 earnedPerToken = (stakeDuration.mul(rewardAmount)).div(10**18);

        uint256 totalEarned = earnedPerToken.mul(staker.balance);

        return totalEarned;
    }
}