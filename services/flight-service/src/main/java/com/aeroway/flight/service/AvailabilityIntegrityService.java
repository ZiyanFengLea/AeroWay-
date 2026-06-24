package com.aeroway.flight.service;

import com.aeroway.flight.dto.AvailabilityIntegrityResponse;
import com.aeroway.flight.model.AvailabilityCheckTarget;
import com.aeroway.flight.repository.AvailabilityCheckTargetRepository;
import com.aeroway.flight.repository.SeatReservationRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

/**
 * Runs a deterministic concurrent booking check against a freshly created flight-seat target.
 * The result demonstrates that PostgreSQL uniqueness protects the system under parallel writes.
 */
@Service
public class AvailabilityIntegrityService {

    private static final int ATTEMPTS = 100;

    private final AvailabilityCheckTargetRepository availabilityCheckTargetRepository;
    private final SeatReservationRepository reservationRepository;

    public AvailabilityIntegrityService(
            AvailabilityCheckTargetRepository availabilityCheckTargetRepository,
            SeatReservationRepository reservationRepository
    ) {
        this.availabilityCheckTargetRepository = availabilityCheckTargetRepository;
        this.reservationRepository = reservationRepository;
    }

    public AvailabilityIntegrityResponse runIntegrityCheck() {
        // CountDownLatch aligns all worker threads so reservation attempts race at nearly the same time.
        AvailabilityCheckTarget target = availabilityCheckTargetRepository.createFreshTarget();
        ExecutorService executor = Executors.newFixedThreadPool(ATTEMPTS);
        CountDownLatch ready = new CountDownLatch(ATTEMPTS);
        CountDownLatch start = new CountDownLatch(1);

        try {
            List<Future<Boolean>> futures = new ArrayList<>();
            for (int i = 0; i < ATTEMPTS; i++) {
                futures.add(executor.submit(createAttempt(target, ready, start, i + 1)));
            }

            await(ready);
            start.countDown();

            int successes = 0;
            for (Future<Boolean> future : futures) {
                if (getResult(future)) {
                    successes++;
                }
            }

            long reservationCount = reservationRepository.countByFlightIdAndSeatId(
                    target.flightId(),
                    target.seatId()
            );
            int conflicts = ATTEMPTS - successes;
            long duplicates = Math.max(0, reservationCount - 1);

            return new AvailabilityIntegrityResponse(ATTEMPTS, successes, conflicts, duplicates);
        } finally {
            executor.shutdownNow();
        }
    }

    private Callable<Boolean> createAttempt(
            AvailabilityCheckTarget target,
            CountDownLatch ready,
            CountDownLatch start,
            int customerNumber
    ) {
        // Each task performs the same insert; exactly one should succeed and the rest should hit a duplicate key.
        return () -> {
            ready.countDown();
            await(start);

            try {
                reservationRepository.create(
                        target.flightId(),
                        target.seatId(),
                        "Availability Customer " + customerNumber
                );
                return true;
            } catch (DuplicateKeyException exception) {
                return false;
            }
        };
    }

    private void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out while preparing the availability check.");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Availability check was interrupted.", exception);
        }
    }

    private boolean getResult(Future<Boolean> future) {
        try {
            return future.get(10, TimeUnit.SECONDS);
        } catch (Exception exception) {
            throw new IllegalStateException("Availability check attempt failed unexpectedly.", exception);
        }
    }
}
