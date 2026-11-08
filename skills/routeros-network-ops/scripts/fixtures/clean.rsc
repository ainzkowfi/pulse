:if ([:len [/ip/firewall/filter/find where comment="pulse-change"]] = 0) do={
    /ip/firewall/filter/add chain=input action=accept comment="pulse-change"
}
