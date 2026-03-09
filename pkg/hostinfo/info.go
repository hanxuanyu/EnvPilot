package hostinfo

import (
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
)

type Snapshot struct {
	Hostname        string  `json:"hostname"`
	Platform        string  `json:"platform"`
	PlatformVersion string  `json:"platform_version"`
	KernelVersion   string  `json:"kernel_version"`
	Architecture    string  `json:"architecture"`
	UptimeSeconds   uint64  `json:"uptime_seconds"`
	BootTimeUnix    uint64  `json:"boot_time_unix"`
	CPUCores        int     `json:"cpu_cores"`
	CPUPercent      float64 `json:"cpu_percent"`
	MemoryTotal     uint64  `json:"memory_total"`
	MemoryUsed      uint64  `json:"memory_used"`
	MemoryPercent   float64 `json:"memory_percent"`
	DiskPath        string  `json:"disk_path"`
	DiskTotal       uint64  `json:"disk_total"`
	DiskUsed        uint64  `json:"disk_used"`
	DiskPercent     float64 `json:"disk_percent"`
	Executable      string  `json:"executable"`
	SampledAtUnix   int64   `json:"sampled_at_unix"`
}

func Collect() Snapshot {
	snapshot := Snapshot{
		Architecture:  runtime.GOARCH,
		CPUCores:      runtime.NumCPU(),
		SampledAtUnix: time.Now().Unix(),
	}

	if executable, err := os.Executable(); err == nil {
		snapshot.Executable = executable
		snapshot.DiskPath = filepath.Dir(executable)
	}
	if snapshot.DiskPath == "" {
		if cwd, err := os.Getwd(); err == nil {
			snapshot.DiskPath = cwd
		}
	}

	if info, err := host.Info(); err == nil {
		snapshot.Hostname = info.Hostname
		snapshot.Platform = info.Platform
		snapshot.PlatformVersion = info.PlatformVersion
		snapshot.KernelVersion = info.KernelVersion
		snapshot.UptimeSeconds = info.Uptime
		snapshot.BootTimeUnix = info.BootTime
	}

	if values, err := cpu.Percent(180*time.Millisecond, false); err == nil && len(values) > 0 {
		snapshot.CPUPercent = values[0]
	}

	if memory, err := mem.VirtualMemory(); err == nil {
		snapshot.MemoryTotal = memory.Total
		snapshot.MemoryUsed = memory.Used
		snapshot.MemoryPercent = memory.UsedPercent
	}

	if snapshot.DiskPath != "" {
		if usage, err := disk.Usage(snapshot.DiskPath); err == nil {
			snapshot.DiskTotal = usage.Total
			snapshot.DiskUsed = usage.Used
			snapshot.DiskPercent = usage.UsedPercent
		}
	}

	return snapshot
}
