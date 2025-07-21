// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ComputeOracle {
    enum JobStatus { NONE, REQUESTED, COMPLETED }

    struct Job {
        address requester;
        bytes32 datasetRoot;
        string baseModel;
        uint256 steps;
        uint256 lr;
        bytes32 resultRoot;
        JobStatus status;
    }

    mapping(bytes32 => Job) public jobs;

    event JobRequested(bytes32 indexed jobId, address indexed requester);
    event JobCompleted(bytes32 indexed jobId, bytes32 resultRoot);

    function requestJob(bytes32 datasetRoot, string calldata baseModel, uint256 steps, uint256 lr) external returns (bytes32) {
        bytes32 jobId = keccak256(abi.encodePacked(msg.sender, datasetRoot, baseModel, steps, lr, block.timestamp));
        jobs[jobId] = Job({
            requester: msg.sender,
            datasetRoot: datasetRoot,
            baseModel: baseModel,
            steps: steps,
            lr: lr,
            resultRoot: bytes32(0),
            status: JobStatus.REQUESTED
        });
        emit JobRequested(jobId, msg.sender);
        return jobId;
    }

    function completeJob(bytes32 jobId, bytes32 resultRoot) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.REQUESTED, "invalid job");
        job.resultRoot = resultRoot;
        job.status = JobStatus.COMPLETED;
        emit JobCompleted(jobId, resultRoot);
    }

    function getJobStatus(bytes32 jobId) external view returns (JobStatus status, bytes32 resultRoot) {
        Job storage job = jobs[jobId];
        return (job.status, job.resultRoot);
    }
}
