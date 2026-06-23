package com.aeroway.flight.controller;

import com.aeroway.flight.dto.AvailabilityIntegrityResponse;
import com.aeroway.flight.service.AvailabilityIntegrityService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AvailabilityController {

    private final AvailabilityIntegrityService availabilityIntegrityService;

    public AvailabilityController(AvailabilityIntegrityService availabilityIntegrityService) {
        this.availabilityIntegrityService = availabilityIntegrityService;
    }

    @PostMapping("/availability/integrity-check")
    public AvailabilityIntegrityResponse runAvailabilityIntegrityCheck() {
        return availabilityIntegrityService.runIntegrityCheck();
    }
}
